"use client";

/**
 * FilesPanel - Files sidebar for the chat. Shows a folder tree of files the AI
 * wrote (extracted from code blocks) merged with the user's edits. Full feature
 * set ported from aero: view, edit (Ctrl+S / Tab / unsaved guard), rename,
 * move (drag between folders), new file, new folder, delete, revert-to-AI,
 * copy, download one / ZIP, shiki syntax highlighting.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import type { MergedFile } from "@/lib/dash/types";
import { createFileOverride, updateFileOverride, deleteFileOverride } from "@/lib/dash/api";
import { useFileOverridesStore } from "@/lib/dash/stores/fileOverridesStore";
import { highlight } from "@/lib/dash/highlight";

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", py: "python",
  go: "go", rs: "rust", rb: "ruby", php: "php", java: "java", kt: "kotlin",
  swift: "swift", cs: "csharp", c: "c", cpp: "cpp", h: "c", html: "html",
  css: "css", scss: "scss", json: "json", yaml: "yaml", yml: "yaml",
  toml: "toml", xml: "xml", md: "markdown", sql: "sql", sh: "bash", txt: "text",
};
const langFromPath = (p: string) => EXT_LANG[p.toLowerCase().split(".").pop() ?? ""] ?? "text";
const basename = (p: string) => p.split("/").pop() ?? p;

type FileNode = { type: "file"; name: string; file: MergedFile };
type FolderNode = { type: "folder"; name: string; path: string; children: Record<string, TreeNode> };
type TreeNode = FileNode | FolderNode;

function buildTree(files: MergedFile[]): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};
  for (const f of files) {
    const parts = f.path.split("/");
    let level = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const last = i === parts.length - 1;
      if (last) {
        if (part === ".gitkeep") continue; // folder placeholder - don't show as a file
        level[part] = { type: "file", name: part, file: f };
      } else {
        const folderPath = parts.slice(0, i + 1).join("/");
        if (!level[part] || level[part].type !== "folder") {
          level[part] = { type: "folder", name: part, path: folderPath, children: {} };
        }
        level = (level[part] as FolderNode).children;
      }
    }
  }
  return root;
}

function sortNodes(nodes: Record<string, TreeNode>): TreeNode[] {
  const arr = Object.values(nodes);
  const folders = arr.filter((n): n is FolderNode => n.type === "folder").sort((a, b) => a.name.localeCompare(b.name));
  const filesN = arr.filter((n): n is FileNode => n.type === "file").sort((a, b) => a.name.localeCompare(b.name));
  return [...folders, ...filesN];
}

export default function FilesPanel({
  conversationId,
  files,
  onClose,
}: {
  conversationId: string;
  files: MergedFile[];
  onClose: () => void;
}) {
  const { upsertFileOverride, removeFileOverrideFromStore } = useFileOverridesStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // files visible in the tree FILE list (real files, not folder placeholders)
  const visibleFiles = useMemo(() => files.filter((f) => !f.path.endsWith("/.gitkeep")), [files]);
  const tree = useMemo(() => buildTree(files), [files]);
  const open = openPath ? visibleFiles.find((f) => f.path === openPath) ?? null : null;
  const dirty = !!open && editing && draft !== open.content;

  // syntax-highlight the open file (view mode only)
  useEffect(() => {
    let alive = true;
    setHtml(null);
    if (open && !editing) {
      const dark = typeof document !== "undefined" && document.documentElement.dataset.theme !== "light";
      highlight(open.content || "", open.language, dark).then((h) => { if (alive) setHtml(h); });
    }
    return () => { alive = false; };
  }, [open, editing]);

  function toggleFolder(path: string) {
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(path)) n.delete(path); else n.add(path);
      return n;
    });
  }

  function selectFile(f: MergedFile) {
    if (dirty && !confirm("Discard unsaved edits?")) return;
    setOpenPath(f.path);
    setEditing(false);
    setDraft(f.content);
  }

  function closeViewer() {
    if (dirty && !confirm("Discard unsaved edits?")) return;
    setOpenPath(null);
    setEditing(false);
  }

  async function save() {
    if (!open) return;
    setBusy(true);
    try {
      const ov = open.overrideId
        ? await updateFileOverride(open.overrideId, { content: draft })
        : await createFileOverride(conversationId, { filePath: open.path, content: draft, language: open.language, source: "edit" });
      upsertFileOverride(conversationId, ov);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  // create override at newPath + remove old path (tombstone AI files / delete user overrides)
  async function moveTo(f: MergedFile, newPath: string) {
    if (newPath === f.path || visibleFiles.some((x) => x.path === newPath)) return;
    setBusy(true);
    let created: { id: string } | null = null;
    try {
      const ov = await createFileOverride(conversationId, {
        filePath: newPath,
        content: f.content,
        language: langFromPath(newPath),
        source: f.source === "ai" ? "edit" : f.source,
      });
      created = ov;
      upsertFileOverride(conversationId, ov);
      if (f.source === "ai") {
        const tomb = await createFileOverride(conversationId, { filePath: f.path, content: "", language: f.language, source: "deleted" });
        upsertFileOverride(conversationId, tomb);
      } else if (f.overrideId) {
        await deleteFileOverride(f.overrideId);
        removeFileOverrideFromStore(conversationId, f.overrideId);
      }
      if (openPath === f.path) setOpenPath(newPath);
    } catch {
      if (created) {
        try { await deleteFileOverride(created.id); removeFileOverrideFromStore(conversationId, created.id); } catch { /* rollback */ }
      }
    } finally {
      setBusy(false);
    }
  }

  function renameFile(f: MergedFile) {
    const next = prompt("Rename file:", basename(f.path))?.trim();
    if (!next) return;
    const parts = f.path.split("/");
    parts[parts.length - 1] = next;
    moveTo(f, parts.join("/"));
  }

  async function remove(f: MergedFile) {
    if (!confirm(`Delete ${f.path}? This can't be undone.`)) return;
    setBusy(true);
    try {
      if (f.source === "created" && f.overrideId) {
        await deleteFileOverride(f.overrideId);
        removeFileOverrideFromStore(conversationId, f.overrideId);
      } else {
        const ov = await createFileOverride(conversationId, { filePath: f.path, content: "", language: f.language, source: "deleted" });
        upsertFileOverride(conversationId, ov);
      }
      if (openPath === f.path) setOpenPath(null);
    } finally {
      setBusy(false);
    }
  }

  // revert an edited AI file back to the AI version (delete the edit override)
  async function revert(f: MergedFile) {
    if (f.source !== "edit" || !f.overrideId) return;
    if (!confirm("Revert to the original AI version? Your edit will be lost.")) return;
    setBusy(true);
    try {
      await deleteFileOverride(f.overrideId);
      removeFileOverrideFromStore(conversationId, f.overrideId);
      if (open) setDraft(f.originalContent ?? "");
    } finally {
      setBusy(false);
    }
  }

  async function newFile() {
    const path = prompt("New file path (e.g. src/utils.ts):")?.trim();
    if (!path || visibleFiles.some((f) => f.path === path)) return;
    setBusy(true);
    try {
      const ov = await createFileOverride(conversationId, { filePath: path, content: "", language: langFromPath(path), source: "created" });
      upsertFileOverride(conversationId, ov);
      setOpenPath(path);
      setEditing(true);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  async function newFolder() {
    const name = prompt("New folder path (e.g. src/components):")?.trim().replace(/\/+$/, "");
    if (!name) return;
    setBusy(true);
    try {
      const ov = await createFileOverride(conversationId, { filePath: `${name}/.gitkeep`, content: "", language: "text", source: "created" });
      upsertFileOverride(conversationId, ov);
    } finally {
      setBusy(false);
    }
  }

  function downloadOne(f: MergedFile) {
    triggerDownload(new Blob([f.content], { type: "text/plain" }), basename(f.path));
  }
  async function downloadZip() {
    const zip = new JSZip();
    for (const f of visibleFiles) zip.file(f.path, f.content);
    triggerDownload(await zip.generateAsync({ type: "blob" }), "aero-files.zip");
  }
  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    if (!open) return;
    try { await navigator.clipboard.writeText(open.content); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ }
  }

  function onEditKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const s = el.selectionStart, en = el.selectionEnd;
      const next = draft.slice(0, s) + "  " + draft.slice(en);
      setDraft(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
    }
  }

  function renderNodes(nodes: Record<string, TreeNode>, depth: number) {
    return sortNodes(nodes).map((node) => {
      if (node.type === "folder") {
        const isCol = collapsed.has(node.path);
        const isDrop = dragOver === node.path;
        return (
          <div key={node.path}>
            <button
              type="button"
              className={`ftree-row ftree-folder ${isDrop ? "is-drop" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => toggleFolder(node.path)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(node.path); }}
              onDragLeave={() => setDragOver((d) => (d === node.path ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                const src = e.dataTransfer.getData("text/path");
                const f = visibleFiles.find((x) => x.path === src);
                if (f) moveTo(f, `${node.path}/${basename(src)}`);
                setDragOver(null);
              }}
            >
              <span className="ftree-caret">{isCol ? "▸" : "▾"}</span>
              {node.name}
            </button>
            {!isCol && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const f = node.file;
      return (
        <button
          key={f.path}
          type="button"
          draggable
          className={`ftree-row ftree-file ${openPath === f.path ? "is-open" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => selectFile(f)}
          onDragStart={(e) => e.dataTransfer.setData("text/path", f.path)}
          title={f.path}
        >
          <span className="ftree-dot" />
          {node.name}
          {f.source !== "ai" && <span className="ftree-tag">{f.source === "created" ? "new" : "edited"}</span>}
        </button>
      );
    });
  }

  return (
    <aside className="files-panel">
      <div className="files-head">
        <span className="files-title mono">FILES <span className="files-count">{visibleFiles.length}</span></span>
        <div className="files-actions">
          <button type="button" className="files-iconbtn" title="New file" onClick={newFile} disabled={busy}>+</button>
          <button type="button" className="files-iconbtn" title="New folder" onClick={newFolder} disabled={busy}>+/</button>
          <button type="button" className="files-iconbtn" title="Download ZIP" onClick={downloadZip} disabled={!visibleFiles.length}>⤓</button>
          <button type="button" className="files-iconbtn" title="Close" onClick={onClose}>✕</button>
        </div>
      </div>

      {visibleFiles.length === 0 ? (
        <div className="files-empty mono">No files yet. When the AI writes code with a filename, it shows up here.</div>
      ) : (
        <div
          className="file-tree"
          onDragOver={(e) => { e.preventDefault(); setDragOver("__root__"); }}
          onDrop={(e) => {
            const src = e.dataTransfer.getData("text/path");
            const f = visibleFiles.find((x) => x.path === src);
            if (f && src.includes("/")) moveTo(f, basename(src)); // move to root
            setDragOver(null);
          }}
        >
          {renderNodes(tree, 0)}
        </div>
      )}

      {open && (
        <div className="file-viewer-overlay" onClick={closeViewer}>
          <div className="file-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="fv-head">
              <span className="fv-path mono">{open.path}</span>
              <div className="fv-actions">
                {editing ? (
                  <>
                    <button className="files-iconbtn" onClick={save} disabled={busy || !dirty} title="Save (Ctrl+S)">save</button>
                    <button className="files-iconbtn" onClick={() => { if (!dirty || confirm("Discard edits?")) { setEditing(false); setDraft(open.content); } }} title="Cancel">cancel</button>
                  </>
                ) : (
                  <>
                    <button className="files-iconbtn" onClick={() => { setEditing(true); setDraft(open.content); }} title="Edit">edit</button>
                    <button className="files-iconbtn" onClick={copy} title="Copy">{copied ? "✓" : "copy"}</button>
                    <button className="files-iconbtn" onClick={() => renameFile(open)} disabled={busy} title="Rename">ren</button>
                    {open.source === "edit" && (
                      <button className="files-iconbtn" onClick={() => revert(open)} disabled={busy} title="Revert to AI version">revert</button>
                    )}
                    <button className="files-iconbtn" onClick={() => downloadOne(open)} title="Download">⤓</button>
                    <button className="files-iconbtn" onClick={() => remove(open)} disabled={busy} title="Delete">del</button>
                  </>
                )}
                <button className="files-iconbtn" onClick={closeViewer} title="Close">✕</button>
              </div>
            </div>
            {editing ? (
              <textarea
                ref={taRef}
                className="fv-edit mono"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onEditKey}
                spellCheck={false}
                autoFocus
              />
            ) : html ? (
              <div className="fv-code fv-shiki" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <pre className="fv-code mono"><code>{open.content || "(empty)"}</code></pre>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
