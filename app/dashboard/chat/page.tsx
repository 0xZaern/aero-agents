'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/dash/stores/chatStore';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import { useWebSocket } from '@/lib/dash/useWebSocket';
import { AGENT_CONSOLE_ROUTE } from '@/lib/dash/agentConsoles';
import {
  createConversation,
  createCrewChat,
  getConversationMessages,
  getModels,
  getAgents,
  getCrews,
  uploadFile,
} from '@/lib/dash/api';
import type { Model, Message, Agent, Crew, AttachmentOut } from '@/lib/dash/types';
import Markdown from '@/components/dash/Markdown';
import ComposerSelect, { type SelOption } from '@/components/dash/ComposerSelect';
import HostTag from '@/components/dash/HostTag';
import { getDefaultModel } from '@/lib/dash/customize';
import { extractFilesFromMessages } from '@/lib/dash/extractFiles';
import { mergeFiles } from '@/lib/dash/mergeFiles';
import { useFileOverridesStore, useFileOverrides } from '@/lib/dash/stores/fileOverridesStore';
import FilesPanel from '@/components/dash/files/FilesPanel';

function cost1k(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.001) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

// human-readable file size
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// terminal-style host name: lowercase, dashes
function hostSlug(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '') || 'aero';
}

const STARTERS = [
  'Write a Python script to rename files in a folder',
  'Explain how blockchain works in simple terms',
  'Write a short funny anecdote about a programmer',
];

// Pull an optional <think>…</think> reasoning block out of assistant content.
function splitThink(content: string): { think: string | null; body: string } {
  const m = content.match(/^([\s\S]*?)<think>([\s\S]*?)<\/think>([\s\S]*)$/i);
  if (!m) return { think: null, body: content };
  return { think: m[2].trim(), body: (m[1] + m[3]).trim() };
}

// ─── Message action icons (revealed on row hover) ───────────────────────────────
const ICON = {
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  regen: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v6h6" /><path d="M21 12A9 9 0 0 0 6 5.3L3 8" /><path d="M21 22v-6h-6" /><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
    </svg>
  ),
};

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="msg-iconbtn" title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <IconBtn
      title={done ? 'Copied' : 'Copy'}
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1200); }}
    >
      {done ? ICON.check : ICON.copy}
    </IconBtn>
  );
}

// ─── Assistant body with collapsible reasoning ──────────────────────────────────
// memo: finalized messages keep the same content, so they skip re-render while the
// streaming message updates many times/sec - otherwise every message re-parses its
// full markdown AST on every streamed token (the source of chat lag).
const AssistantBody = memo(function AssistantBody({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const { think, body } = splitThink(content);
  return (
    <>
      {think && (
        <details className="term-panel" style={{ margin: '4px 0 8px', fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', padding: '6px 10px', color: 'var(--t-dim)' }}>reasoning</summary>
          <pre style={{ margin: 0, padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6 }}>
            {think}
          </pre>
        </details>
      )}
      <Markdown streaming={streaming}>{body}</Markdown>
    </>
  );
});

export default function ChatPage() {
  const {
    conversations,
    addConversation,
    currentConversationId,
    setCurrentConversation,
    messages,
    setMessages,
    addMessage,
    streamingMessage,
    isStreaming,
    selectedModelId,
    setSelectedModelId,
    selectedAgentId,
    setSelectedAgentId,
    selectedCrewId,
    setSelectedCrewId,
    toolEvents,
    setPendingMessage,
    setStreaming,
    clearStreamingMessage,
    finalizeStreamingMessage,
    removeLastAssistantMessage,
    lastError,
    setLastError,
  } = useChatStore();

  const router = useRouter();
  const isPro = useAuthStore((s) => s.isPro());
  const [models, setModels] = useState<Model[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AttachmentOut[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipLoadRef = useRef<string | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const overrides = useFileOverrides(currentConversationId ?? undefined);
  const loadFileOverrides = useFileOverridesStore((s) => s.loadFileOverrides);

  const { sendMessage, stopStreaming } = useWebSocket(currentConversationId);

  // load models / agents / crews
  useEffect(() => {
    getModels()
      .then((m) => {
        setModels(m);
        const def = getDefaultModel();
        if (def && m.some((x) => x.id === def)) setSelectedModelId(def);
        else if (m[0] && !selectedModelId) setSelectedModelId(m[0].id);
      })
      .catch(() => {});
    getAgents('presets').then(setAgents).catch(() => {});
    getCrews().then(setCrews).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickModel(id: string) { setSelectedModelId(id); }
  function pickAgent(id: string) {
    if (!id) { setSelectedAgentId(null); return; }
    const a = agents.find((x) => x.id === id);
    // Agents with a dedicated console (X-Agent, Docs, GitHub, YouTube, Legitimacy)
    // open their own window instead of a plain chat.
    const route = a ? AGENT_CONSOLE_ROUTE[a.name] : undefined;
    if (route) { router.push(route); return; }
    setSelectedAgentId(id); setSelectedCrewId(null);
    if (a?.modelId) setSelectedModelId(a.modelId);
  }
  function pickCrew(id: string) {
    setSelectedCrewId(id || null); if (id) setSelectedAgentId(null);
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    for (const f of files) {
      try { const att = await uploadFile(f); setAttachments((p) => [...p, att]); } catch {}
    }
    setUploading(false);
  }

  // ── Persistent draft: load when conversation changes ──
  const draftKey = `aero.draft.${currentConversationId ?? 'new'}`;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInput(localStorage.getItem(draftKey) ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (input) localStorage.setItem(draftKey, input);
    else localStorage.removeItem(draftKey);
  }, [input, draftKey]);

  // Load messages when the conversation changes. Cached history already shows
  // instantly (see setCurrentConversation); this revalidates in the background.
  useEffect(() => {
    if (!currentConversationId) return;
    if (skipLoadRef.current === currentConversationId) {
      skipLoadRef.current = null;
      return;
    }
    const convId = currentConversationId;
    let cancelled = false;
    getConversationMessages(convId)
      .then((msgs) => {
        // Drop a stale response if the user switched chats mid-fetch - otherwise
        // a slow load for the old chat clobbers the one now on screen.
        if (cancelled || useChatStore.getState().currentConversationId !== convId) return;
        setMessages(msgs);
      })
      .catch(() => { /* keep cached history on failure */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);

  useEffect(() => {
    if (currentConversationId) loadFileOverrides(currentConversationId);
  }, [currentConversationId, loadFileOverrides]);

  // ── Background prefetch: once the sidebar list arrives, warm the message
  //    cache for recent chats (most-recent first) so opening one is instant.
  //    Sequential + delayed so it never competes with the current view. ──
  const prefetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (conversations.length === 0) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const targets = conversations
        .filter((c) => !useChatStore.getState().messageCache[c.id] && !prefetchedRef.current.has(c.id))
        .slice(0, 30);
      for (const c of targets) {
        if (cancelled) return;
        prefetchedRef.current.add(c.id);
        try {
          const msgs = await getConversationMessages(c.id);
          if (!cancelled) useChatStore.getState().primeCache(c.id, msgs);
        } catch { /* ignore - will load on real open */ }
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  // ── Smart auto-scroll: only stick to bottom if already near the bottom ──
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAtBottom(near);
  }, []);
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => {
    if (atBottom) scrollToBottom();
  }, [messages, streamingMessage, toolEvents, atBottom, scrollToBottom]);

  // ── Core send (override lets starter chips send directly) ──
  const send = useCallback(async (override?: string) => {
    const content = (override ?? input).trim();
    if ((!content && attachments.length === 0) || isStreaming) return;
    // Block sending an image to a model that can't read images.
    const sel = models.find((m) => m.id === selectedModelId);
    if (attachments.some((a) => a.kind === 'image') && sel && !sel.supportsVision) {
      setLastError('This model can’t read images. Choose a vision-capable model.');
      return;
    }
    setInput('');
    setLastError(null);
    const attachmentIds = attachments.map((a) => a.id);
    const sentAttachments = attachments;
    setAttachments([]);
    clearStreamingMessage();
    setStreaming(true);

    const userMsg: Message = {
      id: `local-${Date.now()}`,
      conversationId: currentConversationId ?? 'pending',
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      attachments: sentAttachments,
    };

    if (!currentConversationId) {
      // Show the user's message instantly, before the (awaited) conversation
      // creation round-trip - otherwise the composer flips to "thinking" with
      // no message on screen until the network call resolves.
      setMessages([userMsg]);
      try {
        const conv = selectedCrewId
          ? await createCrewChat(selectedCrewId)
          : await createConversation({ modelId: selectedModelId, agentId: selectedAgentId ?? undefined });
        addConversation(conv);
        setPendingMessage({ content, modelId: selectedModelId, attachmentIds });
        skipLoadRef.current = conv.id;
        setCurrentConversation(conv.id);
        setMessages([{ ...userMsg, conversationId: conv.id }]);
        setStreaming(true);
      } catch {
        setInput(content);
        setAttachments(sentAttachments);
        setMessages([]);
        setStreaming(false);
      }
      return;
    }

    addMessage(userMsg);
    sendMessage({ content, model_id: selectedModelId, attachment_ids: attachmentIds });
  }, [input, attachments, isStreaming, currentConversationId, selectedModelId, selectedAgentId, selectedCrewId, models, addConversation, addMessage, sendMessage, setCurrentConversation, setMessages, setPendingMessage, setStreaming, clearStreamingMessage, setLastError]);

  // ── Stop: keep whatever was generated so far ──
  const handleStop = useCallback(() => {
    stopStreaming();
    const partial = useChatStore.getState().streamingMessage;
    if (partial.trim()) {
      finalizeStreamingMessage({
        id: `local-${Date.now()}`,
        conversationId: currentConversationId ?? 'pending',
        role: 'assistant',
        content: partial + '\n\n_(stopped)_',
        modelId: selectedModelId,
        createdAt: new Date().toISOString(),
      });
    } else {
      setStreaming(false);
      clearStreamingMessage();
    }
  }, [stopStreaming, currentConversationId, selectedModelId, finalizeStreamingMessage, setStreaming, clearStreamingMessage]);

  // ── Regenerate the last assistant answer ──
  const handleRegenerate = useCallback(() => {
    if (isStreaming || !currentConversationId) return;
    removeLastAssistantMessage();
    setLastError(null);
    clearStreamingMessage();
    setStreaming(true);
    sendMessage({ content: '', model_id: selectedModelId, regenerate: true });
  }, [isStreaming, currentConversationId, removeLastAssistantMessage, setLastError, clearStreamingMessage, setStreaming, sendMessage, selectedModelId]);

  // ── Retry after an error (re-run last user turn, no duplicate row) ──
  const handleRetry = useCallback(() => {
    if (isStreaming || !currentConversationId) return;
    setLastError(null);
    clearStreamingMessage();
    setStreaming(true);
    sendMessage({ content: '', model_id: selectedModelId, regenerate: true });
  }, [isStreaming, currentConversationId, setLastError, clearStreamingMessage, setStreaming, sendMessage, selectedModelId]);

  // ── Edit the last user message and re-answer ──
  const startEdit = useCallback((m: Message) => { setEditingId(m.id); setEditText(m.content); }, []);
  const saveEdit = useCallback(() => {
    const text = editText.trim();
    if (!text || !currentConversationId) { setEditingId(null); return; }
    // Drop the trailing assistant turn locally + show the edited user message.
    const idx = messages.findIndex((m) => m.id === editingId);
    const kept = idx >= 0 ? messages.slice(0, idx) : messages.slice();
    kept.push({ ...messages[idx], content: text });
    setMessages(kept);
    setEditingId(null);
    setLastError(null);
    clearStreamingMessage();
    setStreaming(true);
    sendMessage({ content: text, model_id: selectedModelId, edit_last: true });
  }, [editText, editingId, messages, currentConversationId, setMessages, setLastError, clearStreamingMessage, setStreaming, sendMessage, selectedModelId]);

  // ── Export the conversation as markdown ──
  const lastUserId = useMemo(() => [...messages].reverse().find((m) => m.role === 'user')?.id, [messages]);
  const lastAssistantId = useMemo(() => [...messages].reverse().find((m) => m.role === 'assistant')?.id, [messages]);

  // Prompt host for assistant lines: crew → agent → model.
  const currentConv = conversations.find((c) => c.id === currentConversationId);
  const convCrew = currentConv?.crewId ? crews.find((c) => c.id === currentConv.crewId) : null;
  const convAgent = currentConv?.agentId ? agents.find((a) => a.id === currentConv.agentId) : null;
  const convHost = convCrew ? hostSlug(convCrew.name) : convAgent ? hostSlug(convAgent.name) : null;
  const liveHost = selectedCrewId
    ? hostSlug(crews.find((c) => c.id === selectedCrewId)?.name ?? 'team')
    : selectedAgentId
    ? hostSlug(agents.find((a) => a.id === selectedAgentId)?.name ?? 'agent')
    : (selectedModelId || 'model');

  // ── Keyboard shortcuts: Cmd/Ctrl+K focus composer · Esc stop ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && useChatStore.getState().isStreaming) {
        handleStop();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleStop]);

  // Files written by the AI (extracted from code blocks) merged with user edits.
  const mergedFiles = useMemo(
    () =>
      mergeFiles(
        extractFilesFromMessages(
          messages,
          isStreaming ? streamingMessage : undefined,
          'streaming',
          overrides.map((o) => o.filePath),
        ),
        overrides,
      ),
    [messages, streamingMessage, isStreaming, overrides],
  );

  const prevFileCount = useRef(0);
  useEffect(() => {
    if (mergedFiles.length > prevFileCount.current && mergedFiles.length > 0) {
      setFilesOpen(true);
    }
    prevFileCount.current = mergedFiles.length;
  }, [mergedFiles.length]);

  // ── Image / vision gating ──
  // When an image is attached, only vision-capable models can read it. The model
  // picker greys out + sinks non-vision models, and sending is blocked until a
  // vision model is selected.
  const hasImage = attachments.some((a) => a.kind === 'image');
  const selModel = models.find((m) => m.id === selectedModelId);
  const blockedImage = hasImage && !!selModel && !selModel.supportsVision;

  const modelOptions: SelOption[] = useMemo(() => {
    const opt = (m: Model): SelOption => ({
      id: m.id,
      label: m.displayName,
      sub: m.provider,
      right: `in ${cost1k(m.inputCostPer1K)} / out ${cost1k(m.outputCostPer1K)} · per 1k`,
    });
    if (!hasImage) return models.map(opt);
    const vision = models.filter((m) => m.supportsVision).map(opt);
    const rest = models.filter((m) => !m.supportsVision).map((m) => ({ ...opt(m), disabled: true, sub: `${m.provider} · no image` }));
    return [...vision, ...rest];
  }, [models, hasImage]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <div ref={scrollRef} className="term-scroll" style={{ flex: 1, padding: '0 20px' }} onScroll={onScroll}>
        <div className="term-thread">
          {messages.length === 0 && !isStreaming && (
            <div className="term-empty" style={{ height: '52vh' }}>
              <div className="big">user@aero:~$ new session</div>
              <div style={{ marginBottom: 16 }}>pick a model below and type a message to begin<span className="term-caret" /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 560 }}>
                {STARTERS.map((s) => (
                  <button key={s} className="term-chip" style={{ cursor: 'pointer' }} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`msg-row ${m.role}`}>
              {m.role === 'user' ? (
                editingId === m.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
                    <textarea
                      className="term-textarea"
                      rows={2}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditingId(null); }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="term-btn primary" style={{ padding: '3px 10px', fontSize: 12 }} onClick={saveEdit}>save &amp; resend</button>
                      <button className="term-btn ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setEditingId(null)}>cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="cmdline">
                      <span className="ps1">user@aero</span><span className="ps1s">:~$</span>
                      <span className="cmd">{m.content}</span>
                    </div>
                    <div className="msg-actions">
                      <CopyBtn text={m.content} />
                      {m.id === lastUserId && !isStreaming && (
                        <IconBtn title="Edit" onClick={() => startEdit(m)}>{ICON.edit}</IconBtn>
                      )}
                    </div>
                  </>
                )
              ) : (
                <>
                  <HostTag
                    host={convHost ?? m.modelId ?? 'model'}
                    model={m.modelId}
                    inTok={m.inputTokens}
                    outTok={m.outputTokens}
                    time={m.createdAt}
                  /><span className="ps1s">:</span>
                  <AssistantBody content={m.content} />
                  {!isStreaming && (
                    <div className="msg-actions">
                      <CopyBtn text={m.content} />
                      {m.id === lastAssistantId && currentConversationId && (
                        <IconBtn title="Regenerate" onClick={handleRegenerate}>{ICON.regen}</IconBtn>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* tool events */}
          {toolEvents.length > 0 && (
            <div className="mono" style={{ padding: '8px 20px', color: 'var(--t-dim)', fontSize: 11 }}>
              {toolEvents.map((t, i) => (
                <div key={i}>
                  <span style={{ color: 'var(--t-accent)' }}>{t.type === 'tool_use' ? '⚙ ' : '✓ '}{t.tool}</span> {t.content?.slice(0, 80)}
                </div>
              ))}
            </div>
          )}

          {/* streaming */}
          {isStreaming && (
            <div className="msg-row assistant">
              <span className="ps1">{convHost ?? liveHost}@aero</span><span className="ps1s">:</span>
              {streamingMessage
                ? <span className="stream-live"><AssistantBody content={streamingMessage} streaming /></span>
                : <span className="term-thinking">thinking<span className="term-dots"><i /><i /><i /></span></span>}
            </div>
          )}

          {/* inline error + retry */}
          {lastError && !isStreaming && (
            <div className="term-panel" style={{ margin: '8px 0', borderColor: 'var(--t-err, #c0392b)' }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span className="pill failed">error</span>
                <span style={{ color: 'var(--text-muted)', flex: 1 }}>{lastError}</span>
                {currentConversationId && (
                  <button className="term-btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={handleRetry}>retry</button>
                )}
                <button className="term-btn ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => setLastError(null)}>dismiss</button>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* jump to latest */}
        {!atBottom && (
          <button
            className="term-btn"
            style={{ position: 'absolute', bottom: 130, left: '50%', transform: 'translateX(-50%)', padding: '5px 14px', fontSize: 12, borderRadius: 20, zIndex: 5 }}
            onClick={() => { scrollToBottom(); setAtBottom(true); }}
          >
            ↓ jump to latest
          </button>
        )}

        {/* composer */}
        <div className="term-composer">
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
            {selectedCrewId ? (
              <span className="term-input mono" style={{ width: 'auto', padding: '6px 12px', fontSize: 12, color: 'var(--t-dim)', opacity: 0.7 }}>
                model · - (team)
              </span>
            ) : (
              <ComposerSelect
                placeholder="select model"
                value={selectedModelId}
                onSelect={pickModel}
                width={280}
                options={modelOptions}
              />
            )}
            <ComposerSelect
              placeholder="no agent"
              value={selectedAgentId}
              onSelect={pickAgent}
              width={240}
              locked={!isPro}
              lockedMessage="Agents are a PRO feature. Upgrade to chat with agents."
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4M8 14h.01M16 14h.01" /></svg>}
              options={[{ id: '', label: 'no agent' }, ...agents.map((a): SelOption => ({ id: a.id, label: a.name, sub: a.modelId }))]}
            />
            {crews.length > 0 && (
              <ComposerSelect
                placeholder="no team"
                value={selectedCrewId}
                onSelect={pickCrew}
                width={240}
                locked={!isPro}
                lockedMessage="Teams are a PRO feature. Upgrade to run teams."
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.65" /></svg>}
                options={[{ id: '', label: 'no team' }, ...crews.map((c): SelOption => ({ id: c.id, label: c.name, sub: c.processType }))]}
              />
            )}
            <button
              type="button"
              className="term-btn ghost"
              style={{ padding: '7px 9px' }}
              title="attach files or images"
              onClick={() => fileRef.current?.click()}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.docx" style={{ display: 'none' }} onChange={onPickFiles} />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {mergedFiles.length > 0 && (
                <button
                  type="button"
                  className={`term-btn ghost mono ${filesOpen ? 'active' : ''}`}
                  style={{ padding: '6px 11px', fontSize: 12 }}
                  title="Files written by the AI"
                  onClick={() => setFilesOpen((v) => !v)}
                >
                  files {mergedFiles.length}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="composer-field">
              {(attachments.length > 0 || uploading) && (
                <div className="composer-atts">
                  {attachments.map((a) => {
                    const remove = () => setAttachments((p) => p.filter((x) => x.id !== a.id));
                    if (a.kind === 'image') {
                      return (
                        <div key={a.id} className="att-thumb" title={a.filename}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.publicUrl} alt={a.filename} />
                          <button className="att-x" onClick={remove} aria-label="remove">✕</button>
                        </div>
                      );
                    }
                    return (
                      <div key={a.id} className="att-file" title={a.filename}>
                        <span className="att-file-ico">{a.kind === 'pdf' ? 'PDF' : a.kind === 'spreadsheet' ? 'XLS' : 'DOC'}</span>
                        <span className="att-file-meta">
                          <span className="att-file-name">{a.filename}</span>
                          <span className="att-file-size">{fmtSize(a.sizeBytes)}</span>
                        </span>
                        <button className="att-x att-x-inline" onClick={remove} aria-label="remove">✕</button>
                      </div>
                    );
                  })}
                  {uploading && (
                    <div className="att-thumb att-thumb-loading">uploading…<span className="term-caret" /></div>
                  )}
                </div>
              )}
              <textarea
                ref={inputRef}
                className="term-textarea term-prompt"
                rows={2}
                value={input}
                disabled={blockedImage}
                placeholder={blockedImage
                  ? `${selModel?.displayName ?? 'this model'} can't read images - choose a vision-capable model above`
                  : 'type a message…  (⌘K to focus)'}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                style={blockedImage ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              />
            </div>
            {isStreaming ? (
              <button className="term-btn ghost" onClick={handleStop}>stop</button>
            ) : (
              <button className="term-btn primary" onClick={() => send()} disabled={(!input.trim() && attachments.length === 0) || blockedImage} title={blockedImage ? 'this model can’t read images' : undefined}>send ↵</button>
            )}
          </div>
          </div>
        </div>
      </div>{/* /chat column */}

      {filesOpen && currentConversationId && (
        <FilesPanel
          conversationId={currentConversationId}
          files={mergedFiles}
          onClose={() => setFilesOpen(false)}
        />
      )}
    </div>
  );
}
