/**
 * highlight.ts - lazy shiki singleton for the file viewer. Loads a fixed set of
 * common languages + the github dark/light themes on first use.
 */

import type { Highlighter } from "shiki";

const LANGS = [
  "typescript", "javascript", "tsx", "jsx", "python", "go", "rust", "ruby",
  "php", "java", "kotlin", "swift", "csharp", "c", "cpp", "html", "css",
  "scss", "json", "yaml", "toml", "xml", "markdown", "sql", "bash",
];
const SUPPORTED = new Set(LANGS);

let promise: Promise<Highlighter> | null = null;

async function get(): Promise<Highlighter> {
  if (!promise) {
    promise = import("shiki").then((s) =>
      s.createHighlighter({ themes: ["github-dark", "github-light"], langs: LANGS }),
    );
  }
  return promise;
}

/** Returns highlighted HTML, or null if highlighting is unavailable. */
export async function highlight(code: string, language: string, dark: boolean): Promise<string | null> {
  try {
    const hl = await get();
    const lang = SUPPORTED.has(language) ? language : "text";
    return hl.codeToHtml(code, { lang, theme: dark ? "github-dark" : "github-light" });
  } catch {
    return null;
  }
}
