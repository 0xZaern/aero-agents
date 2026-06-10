/**
 * extractFiles.ts - scans assistant messages for fenced code blocks that carry a
 * detectable filename and returns them as ExtractedFile[], deduped by path
 * (latest occurrence wins). Ported from aero, self-contained.
 */

import type { ExtractedFile, Message } from "./types";

// First-line comment styles that may carry a filename.
const FILENAME_COMMENT_PATTERNS: readonly RegExp[] = [
  /^[ \t]*#[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*$/, // # file.py
  /^[ \t]*\/\/[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*$/, // // file.js
  /^[ \t]*\/\*[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*\*\/[ \t]*$/, // /* file.css */
  /^[ \t]*<!--[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*-->[ \t]*$/, // <!-- file.html -->
  /^[ \t]*--[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*$/, // -- file.sql
];

const KNOWN_FILE_EXTENSIONS = new Set([
  "py", "js", "ts", "tsx", "jsx", "mjs", "cjs",
  "go", "rs", "rb", "php", "java", "kt", "swift", "scala", "dart",
  "c", "cc", "cpp", "h", "hpp", "cs", "m", "mm",
  "lua", "pl", "r", "jl", "ex", "exs", "erl", "hs", "clj", "fs",
  "html", "htm", "css", "scss", "sass", "less", "vue", "svelte", "astro",
  "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
  "env", "ini", "cfg", "conf", "properties", "gitignore", "dockerfile",
  "json", "yaml", "yml", "toml", "xml", "csv", "tsv",
  "md", "markdown", "txt", "rst", "tex", "sql", "graphql", "proto",
]);

const LANG_ALIASES: Record<string, string> = {
  js: "javascript", ts: "typescript", py: "python",
  shell: "bash", sh: "bash", yml: "yaml", md: "markdown",
};
const normLang = (raw: string) => {
  const l = raw.toLowerCase().trim();
  return LANG_ALIASES[l] ?? (l || "text");
};

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", py: "python", go: "go", rs: "rust",
  rb: "ruby", php: "php", java: "java", kt: "kotlin", swift: "swift",
  cs: "csharp", c: "c", cpp: "cpp", h: "c", hpp: "cpp", html: "html",
  htm: "html", css: "css", scss: "scss", sass: "sass", less: "less",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml", xml: "xml",
  md: "markdown", markdown: "markdown", txt: "text", sql: "sql", sh: "bash", bash: "bash",
};
const LANG_TO_EXT: Record<string, string> = {
  typescript: "ts", javascript: "js", python: "py", go: "go", rust: "rs",
  ruby: "rb", php: "php", java: "java", kotlin: "kt", swift: "swift",
  csharp: "cs", c: "c", cpp: "cpp", html: "html", css: "css", scss: "scss",
  json: "json", yaml: "yaml", toml: "toml", xml: "xml", markdown: "md",
  text: "txt", sql: "sql", bash: "sh",
};
const langFromExt = (filename: string) =>
  EXT_TO_LANG[filename.toLowerCase().split(".").pop() ?? ""] ?? "text";

function pathFromFenceInfo(info: string): string | null {
  const c = info.trim();
  if (!c || /\s/.test(c)) return null;
  const ext = c.toLowerCase().split(".").pop() ?? "";
  return KNOWN_FILE_EXTENSIONS.has(ext) ? c : null;
}

function pathFromFirstLineComment(code: string): { path: string; lineIndex: number } | null {
  const lines = code.split("\n");
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    if (!lines[i].trim()) continue;
    for (const pattern of FILENAME_COMMENT_PATTERNS) {
      const match = lines[i].match(pattern);
      if (!match) continue;
      const candidate = match[1];
      const ext = candidate.toLowerCase().split(".").pop() ?? "";
      if (KNOWN_FILE_EXTENSIONS.has(ext)) return { path: candidate, lineIndex: i };
    }
    break; // only the first non-empty line
  }
  return null;
}

// [1] language, [2] optional fence info, [3] body
const FENCE_RE = /```(\w*)(?:[ \t]+([^\n]*))?\n([\s\S]*?)```/g;

function extractFromText(
  text: string,
  messageId: string,
  createdAt: string,
  results: Map<string, ExtractedFile>,
  knownPaths?: string[],
): void {
  FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE_RE.exec(text)) !== null) {
    const rawLang = match[1] ?? "";
    const fenceInfo = match[2] ?? "";
    const body = match[3] ?? "";

    let detectedPath: string | null = pathFromFenceInfo(fenceInfo);
    let contentBody = body;

    if (!detectedPath) {
      const firstLine = pathFromFirstLineComment(body);
      if (firstLine) {
        detectedPath = firstLine.path;
        const lines = body.split("\n");
        lines.splice(firstLine.lineIndex, 1);
        contentBody = lines.join("\n");
      }
    }

    // backtick / bold path mention right before the block (only if exactly one)
    if (!detectedPath) {
      const before = text.slice(Math.max(0, match.index - 300), match.index);
      const mentions = [
        ...before.matchAll(/(?:`([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)`|\*\*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)\*\*)/g),
      ];
      if (mentions.length === 1) {
        const candidate = mentions[0][1] ?? mentions[0][2];
        const ext = candidate.toLowerCase().split(".").pop() ?? "";
        if (KNOWN_FILE_EXTENSIONS.has(ext)) detectedPath = candidate;
      }
    }

    // match against known sidebar paths (only if exactly one appears)
    if (!detectedPath && knownPaths?.length) {
      const found = knownPaths.filter((kp) => text.includes(kp));
      if (found.length === 1) detectedPath = found[0];
    }

    // auto-name from language so the block still shows up
    if (!detectedPath && rawLang) {
      const ext = LANG_TO_EXT[normLang(rawLang)];
      if (ext) {
        let candidate = `file.${ext}`;
        let n = 2;
        while (results.has(candidate)) candidate = `file_${n++}.${ext}`;
        detectedPath = candidate;
      }
    }

    if (!detectedPath) continue;

    const normPath = detectedPath.replace(/^\.\//, "").replace(/^\/+/, "");
    const language = normLang(rawLang) !== "text" ? normLang(rawLang) : langFromExt(normPath);
    const trimmed = contentBody.replace(/\n+$/, "");

    results.set(normPath, { path: normPath, content: trimmed, language, messageId, createdAt });
  }
}

export function extractFilesFromMessages(
  messages: Message[],
  streamingMessage?: string,
  streamingMessageId?: string,
  knownPaths?: string[],
): ExtractedFile[] {
  const byPath = new Map<string, ExtractedFile>();
  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.content) continue;
    extractFromText(msg.content, msg.id, msg.createdAt, byPath, knownPaths);
  }
  if (streamingMessage && streamingMessageId) {
    extractFromText(streamingMessage, streamingMessageId, new Date().toISOString(), byPath, knownPaths);
  }
  return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
}
