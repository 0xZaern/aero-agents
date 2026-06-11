'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/dash/stores/chatStore';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import { useToastStore } from '@/lib/dash/stores/toastStore';
import { useWebSocket } from '@/lib/dash/useWebSocket';
import ProGate from '@/components/dash/ProGate';
import {
  getAgents,
  getModels,
  createConversation,
  getConversationMessages,
  getXAgentNarratives,
  saveXAgentNarrative,
  deleteXAgentNarrative,
  resolveTwitterUrl,
  suggestKeywords,
  saveXAgentHistory,
  markXAgentHistoryUsedByText,
  getXAgentMemory,
  type XAgentNarrative,
  type KeywordSuggestion,
  type XAgentMemory,
} from '@/lib/dash/api';
import type { Model, Message, Agent } from '@/lib/dash/types';

// ─── Constants ────────────────────────────────────────────────────────────────
const X_AGENT_NAME = 'X (Twitter) Agent';
const TONES = [
  'normal', 'sarcastic', 'question', 'supportive', 'contrarian',
  'expert', 'funny', 'motivational', 'analytical', 'casual',
] as const;
const TWEET_URL_RE = /https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
const MAX_TWEET_CHARS = 2000;
const MAX_NARRATIVES = 20;
const CONV_STORAGE_KEY = 'aero.xagent.convId';

// ─── Reply parsing (ported from the legacy XAgentPanel) ──────────────────────────
interface XAgentReply { text: string; style: string; charCount: number }
interface XAgentData { replies: XAgentReply[]; tips: string[] }

function normalizeReplies(data: XAgentData): XAgentData {
  if (!data || !Array.isArray(data.replies)) return data;
  data.replies = data.replies.map((r) => {
    if (r?.style === 'question' && typeof r.text === 'string') {
      const t = r.text.trim();
      if (t.length > 0 && !/[?？]$/.test(t)) {
        return { ...r, text: `${t.replace(/[.!,;:…]+$/, '')}?` };
      }
    }
    return { ...r, charCount: r.charCount ?? (r.text?.length ?? 0) };
  });
  return data;
}

function parseXAgentContent(content: string): XAgentData | null {
  const tryParse = (s: string): XAgentData | null => {
    try {
      const d = JSON.parse(s) as XAgentData;
      if (d && Array.isArray(d.replies) && d.replies.length > 0) return normalizeReplies(d);
    } catch { /* not json */ }
    return null;
  };
  return (
    tryParse(content) ||
    tryParse(content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)?.[1] ?? '') ||
    tryParse(content.match(/\{[\s\S]*"replies"[\s\S]*\}/)?.[0] ?? '')
  );
}

interface Generation { data: XAgentData; originalInput?: string; modelId?: string; cost?: number }

function extractOriginalInput(userContent: string): string | undefined {
  return userContent.match(/ORIGINAL_INPUT:\s*(.+)/)?.[1]?.trim();
}

// ─── Reply card ─────────────────────────────────────────────────────────────────
function ReplyCard({ reply }: { reply: XAgentReply }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(reply.text).catch(() => {});
    setCopied(true);
    markXAgentHistoryUsedByText(reply.text, reply.style).catch(() => {});
    setTimeout(() => setCopied(false), 1600);
  }, [reply]);

  const count = reply.charCount ?? reply.text.length;
  const countColor = count > 280 ? 'failed' : count >= 70 && count <= 100 ? 'success' : 'paused';

  return (
    <div className="term-panel">
      <div className="term-panel-head">
        {reply.style}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`pill ${countColor}`}>{count} ch</span>
          <button
            className="term-btn ghost"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={handleCopy}
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </span>
      </div>
      <div style={{
        padding: '12px 14px',
        fontFamily: 'var(--font-m)',
        fontSize: 13,
        lineHeight: 1.6,
        color: 'var(--t-text)',
        whiteSpace: 'pre-wrap',
      }}>
        {reply.text}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function XAgentPage() {
  const {
    currentConversationId, setCurrentConversation,
    messages, setMessages, addMessage,
    streamingMessage, isStreaming,
    setStreaming, clearStreamingMessage, setPendingMessage,
  } = useChatStore();
  const { addToast } = useToastStore();
  const { sendMessage } = useWebSocket(currentConversationId);
  const router = useRouter();
  const isPro = useAuthStore((s) => s.isPro());

  // ── Agent / models
  const [agent, setAgent] = useState<Agent | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [modelId, setModelId] = useState<string>('');

  // ── Form state
  const [tweetText, setTweetText] = useState('');
  const [narrative, setNarrative] = useState('');
  const [tones, setTones] = useState<string[]>(['normal']);
  const [useEmojis, setUseEmojis] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  // ── Narratives
  const [narratives, setNarratives] = useState<XAgentNarrative[]>([]);
  const [selectedNarrativeId, setSelectedNarrativeId] = useState<string | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const fromChipRef = useRef(false);

  // ── Keywords / memory
  const [keywords, setKeywords] = useState<KeywordSuggestion[]>([]);
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [memory, setMemory] = useState<XAgentMemory | null>(null);

  // ── Restore the previous X-Agent session (results persist across nav/reload)
  useEffect(() => {
    clearStreamingMessage();
    setStreaming(false);
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(CONV_STORAGE_KEY) : null;
    if (savedId) {
      setCurrentConversation(savedId);
      getConversationMessages(savedId)
        .then(setMessages)
        .catch(() => { // conversation gone - drop the stale pointer
          localStorage.removeItem(CONV_STORAGE_KEY);
          setCurrentConversation(null);
          setMessages([]);
        });
    } else {
      setCurrentConversation(null);
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start a brand-new session (clears saved results)
  const newSession = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.removeItem(CONV_STORAGE_KEY);
    setCurrentConversation(null);
    setMessages([]);
    clearStreamingMessage();
    setStreaming(false);
  }, [setCurrentConversation, setMessages, clearStreamingMessage, setStreaming]);

  // ── Load agent preset + models + narratives + memory
  useEffect(() => {
    getAgents('presets').then((list) => {
      const a = list.find((x) => x.name === X_AGENT_NAME) ?? null;
      setAgent(a);
      if (a?.modelId) setModelId(a.modelId);
    }).catch(() => {});
    getModels().then((m) => {
      setModels(m);
      setModelId((cur) => cur || m[0]?.id || '');
    }).catch(() => {});
    getXAgentNarratives().then(setNarratives).catch(() => {});
    getXAgentMemory().then(setMemory).catch(() => {});
  }, []);

  const refreshMemory = useCallback(() => {
    getXAgentMemory().then(setMemory).catch(() => {});
  }, []);

  // ── Parse generations from assistant messages (newest first)
  const generations = useMemo<Generation[]>(() => {
    const out: Generation[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;
      const data = parseXAgentContent(msg.content);
      if (!data) continue;
      let originalInput: string | undefined;
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].role === 'user') { originalInput = extractOriginalInput(messages[j].content); break; }
      }
      out.push({ data, originalInput, modelId: msg.modelId, cost: msg.cost });
    }
    return out.reverse();
  }, [messages]);

  // ── Streaming partial parse
  const streamingData = useMemo<XAgentData | null>(() => {
    if (!isStreaming || !streamingMessage) return null;
    return parseXAgentContent(streamingMessage);
  }, [isStreaming, streamingMessage]);

  // ── Save replies to history when a generation completes
  const prevStreaming = useRef(false);
  useEffect(() => {
    if (prevStreaming.current && !isStreaming && generations.length > 0) {
      const latest = generations[0];
      const tweet = latest.originalInput || 'unknown';
      const entries = latest.data.replies.map((r) => ({
        tweet_text: tweet, reply_text: r.text, tone: r.style, char_count: r.charCount ?? r.text.length,
      }));
      if (entries.length > 0) {
        saveXAgentHistory(entries).then(refreshMemory).catch(() => {});
      }
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, generations, refreshMemory]);

  // ── Narrative handlers
  const selectNarrative = (n: XAgentNarrative) => {
    setSelectedNarrativeId(n.id); fromChipRef.current = true; setNarrative(n.text);
  };
  const changeNarrative = (v: string) => {
    if (fromChipRef.current) { fromChipRef.current = false; setSelectedNarrativeId(null); }
    setNarrative(v);
  };
  const confirmSave = async () => {
    const name = (savingName ?? '').trim();
    if (!name) return;
    if (!narrative.trim()) { addToast('Write your narrative first', 'info'); return; }
    if (narratives.length >= MAX_NARRATIVES) { addToast(`Max ${MAX_NARRATIVES} narratives`, 'error'); return; }
    try {
      const saved = await saveXAgentNarrative(name, narrative.trim());
      setNarratives((p) => [...p, saved]);
      setSelectedNarrativeId(saved.id); fromChipRef.current = true;
    } catch { addToast('Failed to save narrative', 'error'); }
    setSavingName(null);
  };
  const deleteNarrative = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteXAgentNarrative(id);
      setNarratives((p) => p.filter((n) => n.id !== id));
      if (selectedNarrativeId === id) setSelectedNarrativeId(null);
    } catch { addToast('Failed to delete narrative', 'error'); }
  };

  // ── Tone toggle (1-3)
  const toggleTone = (t: string) => {
    setTones((prev) => {
      if (prev.includes(t)) return prev.length <= 1 ? prev : prev.filter((x) => x !== t);
      return prev.length >= 3 ? prev : [...prev, t];
    });
  };

  // ── Keywords
  const handleSuggestKeywords = async () => {
    if (!narrative.trim()) { addToast('Write a narrative first', 'error'); return; }
    setLoadingKeywords(true);
    try {
      const res = await suggestKeywords(narrative.trim(), modelId || undefined);
      setKeywords(res.keywords);
    } catch { addToast('Failed to suggest keywords', 'error'); }
    finally { setLoadingKeywords(false); }
  };

  // ── Generate
  const isBusy = isStreaming || isResolving;
  const canGenerate = tweetText.trim().length > 0 && !isBusy && !!agent;

  const handleGenerate = useCallback(async () => {
    if (!agent || isBusy) return;
    let tweet = tweetText.trim();
    if (!tweet) return;
    const rawInput = tweet;
    let tweetId: string | undefined;

    if (TWEET_URL_RE.test(tweet)) {
      setIsResolving(true);
      try {
        const resolved = await resolveTwitterUrl(tweet);
        tweet = resolved.text;
        if (resolved.tweet_id) tweetId = resolved.tweet_id;
      } catch {
        setIsResolving(false);
        addToast('Could not fetch tweet - paste the text instead', 'error');
        return;
      }
      setIsResolving(false);
    }

    const savedNarrative = selectedNarrativeId ? narratives.find((n) => n.id === selectedNarrativeId) : null;
    const tweetIdPart = tweetId ? ` tweetId=${tweetId}` : '';
    const config = `[X-AGENT CONFIG] tones=${tones.join(',')} emojis=${useEmojis ? 'on' : 'off'}${tweetIdPart}`;
    const originalLine = `\nORIGINAL_INPUT: ${rawInput}`;
    const narrativeNameLine = savedNarrative ? `\nNARRATIVE_NAME: ${savedNarrative.name}` : '';
    const narrativePart = narrative.trim() ? `\nMY NARRATIVE: ${narrative.trim()}` : '';
    const content = `${config}${originalLine}${narrativeNameLine}${narrativePart}\n\nTWEET TO REPLY TO:\n"${tweet}"`;

    clearStreamingMessage();
    setStreaming(true);

    const userMsg: Message = {
      id: `local-${performance.now()}`,
      conversationId: currentConversationId ?? 'pending',
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    if (!currentConversationId) {
      try {
        const conv = await createConversation({ modelId, agentId: agent.id });
        if (typeof window !== 'undefined') localStorage.setItem(CONV_STORAGE_KEY, conv.id);
        setPendingMessage({ content, modelId, attachmentIds: [] });
        setMessages([{ ...userMsg, conversationId: conv.id }]);
        setCurrentConversation(conv.id);
        setStreaming(true);
      } catch {
        setStreaming(false);
        addToast('Failed to start session', 'error');
        return;
      }
    } else {
      addMessage(userMsg);
      sendMessage({ content, model_id: modelId, attachment_ids: [] });
    }

    setTweetText('');
  }, [
    agent, isBusy, tweetText, tones, useEmojis, narrative, selectedNarrativeId, narratives,
    modelId, currentConversationId, sendMessage, addMessage, setMessages, setCurrentConversation,
    setPendingMessage, setStreaming, clearStreamingMessage, addToast,
  ]);

  const recIds = new Set((agent?.recommendedModels ?? []).map((r) => r.modelId));
  const recModels = models.filter((m) => recIds.has(m.id));
  const otherModels = models.filter((m) => !recIds.has(m.id));
  const hasResults = generations.length > 0;

  if (!isPro) return <ProGate feature="Agents" />;

  return (
    <div className="term-scroll">
      <div className="term-pad" style={{ maxWidth: 1100, marginLeft: 'auto', marginRight: 'auto' }}>

        {/* header with inline back button */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, marginBottom: 14 }}>
          <button
            className="term-btn ghost"
            title="back to chat"
            aria-label="back to chat"
            style={{
              width: 30,
              height: 'auto',
              alignSelf: 'stretch',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            onClick={() => { useChatStore.getState().setSelectedAgentId(null); router.push('/dashboard/chat'); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div style={{
              fontFamily: 'var(--font-m)',
              color: 'var(--t-dim)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              agent / x (twitter)
            </div>
            <div style={{ fontFamily: 'var(--font-m)', color: 'var(--t-muted)', fontSize: 12 }}>
              generate on-brand replies to any tweet - paste a tweet or x.com link, pick tones, go
            </div>
          </div>
        </div>

        {/* tips strip */}
        <div
          className="term-panel"
          style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px' }}
        >
          <span style={{
            fontFamily: 'var(--font-m)',
            color: 'var(--t-dim)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            tips
          </span>
          <span style={{
            fontFamily: 'var(--font-m)',
            fontSize: 12,
            color: 'var(--t-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            reply within 15 min · best Tue-Thu 8-11am EST · target 40-50 replies/day · sweet spot 70-100 chars · ask questions, never just agree
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>

          {/* ── LEFT: form ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* their tweet */}
            <div className="term-panel">
              <div className="term-panel-head">
                their tweet
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--font-m)',
                  color: tweetText.length > MAX_TWEET_CHARS ? '#f87171' : 'var(--t-dim)',
                  fontSize: 11,
                }}>
                  {tweetText.length} / {MAX_TWEET_CHARS}
                </span>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <textarea
                  className="term-textarea"
                  rows={3}
                  value={tweetText}
                  placeholder="paste tweet text or x.com link"
                  onChange={(e) => setTweetText(e.target.value.slice(0, MAX_TWEET_CHARS))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && canGenerate) { e.preventDefault(); handleGenerate(); } }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* saved narratives */}
            <div className="term-panel">
              <div className="term-panel-head">saved narratives</div>
              <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {narratives.map((n) => (
                  <span
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectNarrative(n)}
                    title={n.text}
                    className={`term-chip${selectedNarrativeId === n.id ? ' accent' : ''}`}
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                    <button
                      onClick={(e) => deleteNarrative(n.id, e)}
                      style={{ color: 'var(--t-dim)', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      x
                    </button>
                  </span>
                ))}
                {savingName === null ? (
                  <button className="term-chip" style={{ cursor: 'pointer' }} onClick={() => setSavingName('')}>+ save current</button>
                ) : (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <input
                      autoFocus
                      className="term-input"
                      style={{ width: 140, padding: '4px 8px', fontSize: 12 }}
                      placeholder="name"
                      value={savingName}
                      onChange={(e) => setSavingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') setSavingName(null); }}
                    />
                    <button className="term-btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={confirmSave}>save</button>
                    <button className="term-btn ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setSavingName(null)}>x</button>
                  </span>
                )}
              </div>
            </div>

            {/* your narrative */}
            <div className="term-panel">
              <div className="term-panel-head">your narrative</div>
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  className="term-textarea"
                  rows={3}
                  value={narrative}
                  placeholder="who you are on X - your vibe, audience, topics"
                  onChange={(e) => changeNarrative(e.target.value)}
                  style={{ width: '100%' }}
                />
                <button
                  className="term-btn ghost"
                  onClick={handleSuggestKeywords}
                  disabled={loadingKeywords || !narrative.trim()}
                  style={{ fontSize: 12 }}
                >
                  {loadingKeywords ? 'suggesting...' : 'suggest keywords'}
                </button>
                {keywords.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {keywords.map((kw, i) => (
                      <span
                        key={`${kw.keyword}-${i}`}
                        role="button"
                        tabIndex={0}
                        className="term-chip"
                        title={kw.exampleSearch}
                        style={{ cursor: 'pointer' }}
                        onClick={() => { navigator.clipboard.writeText(kw.exampleSearch).catch(() => {}); addToast('search copied', 'success'); }}
                      >
                        {kw.keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* tones */}
            <div className="term-panel">
              <div className="term-panel-head">
                reply tone
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-m)', color: 'var(--t-dim)', fontSize: 11 }}>{tones.length} / 3</span>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TONES.map((t) => {
                  const sel = tones.includes(t);
                  const maxed = tones.length >= 3 && !sel;
                  return (
                    <button
                      key={t}
                      disabled={maxed}
                      onClick={() => toggleTone(t)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: 'var(--t-radius-sm)',
                        fontFamily: 'var(--font-m)',
                        fontSize: 11,
                        letterSpacing: '0.04em',
                        border: '1px solid',
                        background: sel ? 'var(--t-accent-soft)' : 'var(--t-elev)',
                        borderColor: sel ? 'var(--t-accent-dim)' : 'var(--t-border-2)',
                        color: sel ? 'var(--t-accent)' : 'var(--t-muted)',
                        cursor: maxed ? 'not-allowed' : 'pointer',
                        opacity: maxed ? 0.4 : 1,
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* options: emojis + model */}
            <div className="term-panel">
              <div className="term-panel-head">options</div>
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'var(--font-m)',
                  fontSize: 12,
                  color: 'var(--t-muted)',
                  cursor: 'pointer',
                }}>
                  <span style={{ position: 'relative', width: 13, height: 13, display: 'inline-flex', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={useEmojis}
                      onChange={(e) => setUseEmojis(e.target.checked)}
                      style={{
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        margin: 0,
                        width: 13,
                        height: 13,
                        background: 'var(--t-bg)',
                        border: `1px solid ${useEmojis ? 'var(--t-accent-dim)' : 'var(--t-border-2)'}`,
                        borderRadius: 3,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                    />
                    {useEmojis && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--t-accent)',
                          fontFamily: 'var(--font-m)',
                          fontSize: 10,
                          lineHeight: 1,
                          pointerEvents: 'none',
                        }}
                      >
                        x
                      </span>
                    )}
                  </span>
                  use emojis
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-m)', color: 'var(--t-dim)', fontSize: 11 }}>model</span>
                  <select
                    className="term-input"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    style={{ flex: 1, padding: '5px 26px 5px 9px', fontSize: 12 }}
                  >
                    {recModels.length > 0 && (
                      <optgroup label="recommended">
                        {recModels.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                      </optgroup>
                    )}
                    <optgroup label="all models">
                      {otherModels.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>

            {/* generate */}
            <button
              className="term-btn primary"
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{ width: '100%', padding: '10px' }}
            >
              {isResolving ? 'fetching tweet...' : isStreaming ? 'generating...' : 'generate replies'}
            </button>
            {!agent && (
              <div style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--t-dim)' }}>
                loading X-Agent preset... (ensure the backend is seeded)
              </div>
            )}
          </div>

          {/* ── RIGHT: results ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* results column header - matches term-panel-head style exactly */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-m)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--t-muted)',
            }}>
              generated replies
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                {memory && memory.total_replies_generated > 0 && (
                  <span style={{ fontFamily: 'var(--font-m)', color: 'var(--t-dim)', fontSize: 11, letterSpacing: 0 }}>
                    {memory.total_replies_generated} generated · {memory.total_replies_used} used
                  </span>
                )}
                {hasResults && (
                  <button className="term-btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={newSession}>
                    new session
                  </button>
                )}
              </span>
            </div>

            {/* streaming */}
            {isStreaming && (
              streamingData
                ? streamingData.replies.map((r, i) => <ReplyCard key={`s${i}`} reply={r} />)
                : (
                  <div className="term-panel">
                    <div style={{ padding: '14px', fontFamily: 'var(--font-m)', fontSize: 12, color: 'var(--t-dim)' }}>
                      generating<span className="term-caret" />
                    </div>
                  </div>
                )
            )}

            {/* completed generations */}
            {!isStreaming && generations.map((gen, gi) => (
              <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {gen.originalInput && (
                  <div style={{
                    fontFamily: 'var(--font-m)',
                    fontSize: 11,
                    color: 'var(--t-dim)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {gen.originalInput}
                  </div>
                )}
                {gen.data.replies.map((r, i) => <ReplyCard key={i} reply={r} />)}
                {gen.data.tips?.length > 0 && (
                  <div className="term-panel">
                    <div className="term-panel-head">tips</div>
                    <div style={{ padding: '10px 14px', fontFamily: 'var(--font-m)', fontSize: 12, color: 'var(--t-muted)', lineHeight: 1.6 }}>
                      {gen.data.tips.map((tip, i) => <div key={i}>· {tip}</div>)}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* empty state */}
            {!isStreaming && !hasResults && (
              <div className="term-empty" style={{ minHeight: 200 }}>
                <div style={{ fontFamily: 'var(--font-m)', fontSize: 13, color: 'var(--t-muted)' }}>no replies yet</div>
                <div style={{ fontFamily: 'var(--font-m)', fontSize: 12, color: 'var(--t-dim)' }}>
                  fill in a tweet and hit generate<span className="term-caret" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
