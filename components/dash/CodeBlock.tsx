"use client";

/**
 * CodeBlock - renders a fenced code block in chat as a card: filename header
 * (detected from a first-line comment), shiki syntax highlighting, copy button.
 */

import { useEffect, useState } from "react";
import { highlight } from "@/lib/dash/highlight";

const ALIAS: Record<string, string> = {
  js: "javascript", ts: "typescript", py: "python", sh: "bash", shell: "bash",
  yml: "yaml", md: "markdown", rb: "ruby", rs: "rust",
};

const COMMENT_PATTERNS: RegExp[] = [
  /^[ \t]*#[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*$/,
  /^[ \t]*\/\/[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*$/,
  /^[ \t]*\/\*[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*\*\/[ \t]*$/,
  /^[ \t]*<!--[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*-->[ \t]*$/,
  /^[ \t]*--[ \t]*([A-Za-z0-9._\-/]+\.[A-Za-z0-9]+)[ \t]*$/,
];

function detectFilename(code: string): { name: string; body: string } | null {
  const lines = code.split("\n");
  const idx = lines.findIndex((l) => l.trim());
  if (idx < 0) return null;
  for (const p of COMMENT_PATTERNS) {
    const m = lines[idx].match(p);
    if (m) {
      lines.splice(idx, 1);
      return { name: m[1], body: lines.join("\n").replace(/^\n+/, "") };
    }
  }
  return null;
}

export default function CodeBlock({ lang, code, name: fenceName, plain = false }: { lang: string; code: string; name?: string; plain?: boolean }) {
  // Filename precedence: the fence (```py app.py) wins; otherwise fall back to a
  // first-line comment in the body. Only strip the body when the name came from
  // that comment - a fence name leaves the file contents untouched.
  const detected = fenceName ? null : detectFilename(code);
  const name = fenceName ?? detected?.name ?? null;
  const body = (detected?.body ?? code).replace(/\n+$/, "");
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // While streaming we render plain text and skip shiki entirely - avoids
    // re-highlighting on every token (slow + flickery). The finalized message
    // re-mounts with plain=false and gets full highlighting.
    if (plain) return;
    let alive = true;
    const dark = typeof document !== "undefined" && document.documentElement.dataset.theme !== "light";
    highlight(body, ALIAS[lang] ?? lang ?? "text", dark).then((h) => { if (alive) setHtml(h); });
    return () => { alive = false; };
  }, [body, lang, plain]);

  return (
    <div className="cb">
      <div className="cb-head">
        <span className="cb-name mono">{name ?? lang ?? "code"}</span>
        <button
          type="button"
          className={`cb-copy mono${copied ? " copied" : ""}`}
          onClick={async () => {
            try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ }
          }}
        >
          {copied ? (
            <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>copied</>
          ) : (
            <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>copy</>
          )}
        </button>
      </div>
      {!plain && html ? (
        <div className="cb-body fv-shiki" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="cb-body mono"><code>{body}</code></pre>
      )}
    </div>
  );
}
