'use client';

import { useEffect, useRef, useState } from 'react';
import type { Agent, AgentTestResponse, Model } from '@/lib/dash/types';
import {
  getModels,
  updateAgent,
  testAgent,
  improveBackstory,
} from '@/lib/dash/api';
import { formatCost } from '@/lib/dash/utils';

// Canonical tool list matching backend TOOL_REGISTRY
const AVAILABLE_TOOLS: { id: string; label: string; desc: string; comingSoon?: boolean }[] = [
  { id: 'web_search', label: 'web_search', desc: 'searches the web for current info' },
  { id: 'url_reader', label: 'url_reader', desc: 'opens any url and reads its content' },
  { id: 'code_executor', label: 'code_executor', desc: 'writes and runs python code' },
  { id: 'image_generator', label: 'image_generator', desc: 'generates images from prompts', comingSoon: true },
];

type AgentFormState = Omit<Agent, 'id' | 'isPreset'>;

const DEFAULT_FORM: AgentFormState = {
  name: '',
  role: '',
  goal: '',
  backstory: '',
  modelId: 'deepseek-v3.2',
  tools: [],
  temperature: 0.7,
  maxTokens: 4096,
  isPublished: false,
  sourceAgentId: null,
  publishedAt: null,
  unlisted: false,
  removedByAdmin: false,
  authorDisplayName: null,
};

interface AgentEditorProps {
  agent: Agent | null;            // null = new agent
  onSave: (data: AgentFormState) => Promise<void>;
  onDelete: () => Promise<void>;  // soft delete - only called for owned agents
  onClose: () => void;
  isSaving?: boolean;
  onUpdated?: (agent: Agent) => void; // notify parent after preset auto-save
}

export function AgentEditor({
  agent,
  onSave,
  onDelete,
  onClose,
  isSaving,
  onUpdated,
}: AgentEditorProps) {
  const [form, setForm] = useState<AgentFormState>(DEFAULT_FORM);
  const [models, setModels] = useState<Model[]>([]);
  const [advOpen, setAdvOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AgentFormState, string>>>({});

  // test state
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<AgentTestResponse | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // improve backstory state
  const [isImproving, setIsImproving] = useState(false);
  const [backstoryOriginal, setBackstoryOriginal] = useState<string | null>(null);

  // publish state
  const [publicDesc, setPublicDesc] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // preset auto-save state
  const [presetSaveStatus, setPresetSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const presetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPreset = agent?.isPreset === true;

  // Migrate legacy tool names from old backend
  function migrateLegacyTools(tools: string[]): string[] {
    const rename: Record<string, string> = {
      http_request: 'url_reader',
      code_interpreter: 'code_executor',
    };
    const drop = new Set(['file_read', 'file_write', 'calculator', 'shell', 'database_query']);
    const out = new Set<string>();
    for (const t of tools) {
      if (drop.has(t)) continue;
      out.add(rename[t] ?? t);
    }
    return [...out];
  }

  // Load models on mount
  useEffect(() => {
    getModels()
      .then((ms) => setModels(ms.filter((m) => m.isActive)))
      .catch(() => {});
  }, []);

  // Reset form when agent changes
  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        role: agent.role,
        goal: agent.goal ?? '',
        backstory: agent.backstory ?? '',
        modelId: agent.modelId,
        tools: migrateLegacyTools(agent.tools),
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        isPublished: agent.isPublished,
        sourceAgentId: agent.sourceAgentId,
        publishedAt: agent.publishedAt,
        unlisted: agent.unlisted,
        removedByAdmin: agent.removedByAdmin,
        authorDisplayName: agent.authorDisplayName,
        publicDescription: agent.publicDescription,
        recommendedModels: agent.recommendedModels,
        reportCount: agent.reportCount,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setErrors({});
    setTestInput('');
    setTestResult(null);
    setBackstoryOriginal(null);
    setAdvOpen(false);
    setTestOpen(false);
    setPublishOpen(false);
    setDeleteConfirm(false);
    setPublicDesc('');
    setPresetSaveStatus('idle');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (presetTimerRef.current) clearTimeout(presetTimerRef.current);
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function validate(): boolean {
    if (isPreset) return true;
    const errs: Partial<Record<keyof AgentFormState, string>> = {};
    if (!form.name.trim()) errs.name = 'required';
    if (!form.role.trim()) errs.role = 'required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    await onSave(form);
  }

  async function handlePresetModelChange(modelId: string) {
    if (!agent?.id) return;
    setForm((p) => ({ ...p, modelId }));
    if (presetTimerRef.current) clearTimeout(presetTimerRef.current);
    setPresetSaveStatus('saving');
    const t0 = Date.now();
    try {
      const updated = await updateAgent(agent.id, { modelId } as Partial<Agent>);
      onUpdated?.(updated);
      const elapsed = Date.now() - t0;
      const show = () => {
        setPresetSaveStatus('saved');
        presetTimerRef.current = setTimeout(() => setPresetSaveStatus('idle'), 2500);
      };
      if (elapsed < 350) {
        presetTimerRef.current = setTimeout(show, 350 - elapsed);
      } else {
        show();
      }
    } catch {
      setPresetSaveStatus('error');
    }
  }

  function toggleTool(id: string) {
    setForm((p) => ({
      ...p,
      tools: p.tools.includes(id) ? p.tools.filter((t) => t !== id) : [...p.tools, id],
    }));
  }

  async function handleTest() {
    if (!agent?.id || !testInput.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAgent(agent.id, testInput.trim());
      setTestResult(res);
    } catch {
      // toast from request()
    } finally {
      setIsTesting(false);
    }
  }

  async function handleImprove() {
    const draft = form.backstory?.trim() ?? '';
    if (draft.length < 20) return;
    setIsImproving(true);
    try {
      const { improved } = await improveBackstory(draft);
      setBackstoryOriginal(draft);
      setForm((p) => ({ ...p, backstory: improved }));
    } catch {
      // toast from request()
    } finally {
      setIsImproving(false);
    }
  }

  const title = isPreset
    ? agent?.name ?? 'preset'
    : agent
    ? 'edit agent'
    : 'new agent';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.55)',
        }}
        aria-hidden
      />

      {/* Slide-in panel */}
      <div
        role="dialog"
        aria-label={title}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: 420,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border-strong)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="term-panel-head"
          style={{ padding: '10px 14px', justifyContent: 'space-between' }}
        >
          <span>{title}</span>
          <button
            className="term-btn ghost"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={onClose}
            aria-label="close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="term-scroll" style={{ flex: 1 }}>
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── PRESET BRANCH ── */}
            {isPreset ? (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 2 }}>
                  preset · instructions are private. you may only change the model.
                </div>

                {agent?.publicDescription && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                      about
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {agent.publicDescription}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      model
                    </div>
                    {presetSaveStatus === 'saving' && (
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>saving…</span>
                    )}
                    {presetSaveStatus === 'saved' && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>saved ✓</span>
                    )}
                    {presetSaveStatus === 'error' && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>save failed</span>
                    )}
                  </div>
                  <select
                    className="term-input"
                    style={{ fontSize: 12 }}
                    value={form.modelId}
                    onChange={(e) => handlePresetModelChange(e.target.value)}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName} · {m.provider}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 5 }}>
                    changes save automatically
                  </div>
                </div>
              </>
            ) : (
              /* ── CUSTOM / NEW BRANCH ── */
              <>
                {/* identity section */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                    identity
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>name {errors.name && <span style={{ color: 'var(--text-muted)' }}>· {errors.name}</span>}</label>
                      <input
                        className="term-input"
                        style={{ fontSize: 12 }}
                        value={form.name}
                        placeholder="crypto helper"
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>role {errors.role && <span style={{ color: 'var(--text-muted)' }}>· {errors.role}</span>}</label>
                      <input
                        className="term-input"
                        style={{ fontSize: 12 }}
                        value={form.role}
                        placeholder="tracks crypto prices and news"
                        onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>goal</label>
                      <textarea
                        className="term-textarea"
                        style={{ fontSize: 12 }}
                        rows={2}
                        value={form.goal}
                        placeholder="what the agent always tries to do…"
                        onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>backstory</label>
                        {(form.backstory?.trim().length ?? 0) >= 20 && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {backstoryOriginal !== null && (
                              <button
                                className="term-btn ghost"
                                style={{ padding: '2px 7px', fontSize: 10 }}
                                onClick={() => {
                                  setForm((p) => ({ ...p, backstory: backstoryOriginal }));
                                  setBackstoryOriginal(null);
                                }}
                              >
                                undo
                              </button>
                            )}
                            <button
                              className="term-btn ghost"
                              style={{ padding: '2px 7px', fontSize: 10 }}
                              disabled={isImproving}
                              onClick={handleImprove}
                            >
                              {isImproving ? 'improving…' : '✦ improve'}
                            </button>
                          </div>
                        )}
                      </div>
                      <textarea
                        className="term-textarea"
                        style={{ fontSize: 12 }}
                        rows={5}
                        value={form.backstory}
                        placeholder="who this agent is, their expertise, personality, and how they think…"
                        onChange={(e) => {
                          setForm((p) => ({ ...p, backstory: e.target.value }));
                          setBackstoryOriginal(null);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* intelligence section */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                    intelligence
                  </div>
                  <select
                    className="term-input"
                    style={{ fontSize: 12 }}
                    value={form.modelId}
                    onChange={(e) => setForm((p) => ({ ...p, modelId: e.target.value }))}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName} · {m.provider}</option>
                    ))}
                  </select>
                </div>

                {/* capabilities section */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                    capabilities
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {AVAILABLE_TOOLS.map((tool) => {
                      const selected = form.tools.includes(tool.id);
                      return (
                        <label
                          key={tool.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '8px 10px',
                            border: `1px solid ${selected ? 'var(--border-strong)' : 'var(--border)'}`,
                            borderRadius: 2,
                            background: selected ? 'var(--surface)' : 'var(--bg-2)',
                            cursor: tool.comingSoon ? 'not-allowed' : 'pointer',
                            opacity: tool.comingSoon ? 0.5 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={tool.comingSoon}
                            onChange={() => { if (!tool.comingSoon) toggleTool(tool.id); }}
                            style={{ marginTop: 2, accentColor: 'var(--text)' }}
                          />
                          <div>
                            <div style={{ fontSize: 12, color: selected ? 'var(--text)' : 'var(--text-muted)' }}>
                              {tool.label}
                              {tool.comingSoon && (
                                <span style={{ marginLeft: 8, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                                  soon
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                              {tool.desc}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* advanced section */}
                <div>
                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10,
                      color: 'var(--text-dim)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      width: '100%',
                      textAlign: 'left',
                    }}
                    onClick={() => setAdvOpen((v) => !v)}
                    aria-expanded={advOpen}
                  >
                    <span>{advOpen ? '▾' : '▸'}</span> advanced settings
                  </button>
                  {advOpen && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>temperature</label>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {form.temperature.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.05}
                          value={form.temperature}
                          onChange={(e) => setForm((p) => ({ ...p, temperature: parseFloat(e.target.value) }))}
                          style={{ width: '100%', accentColor: 'var(--text)' }}
                          aria-label="temperature"
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                          <span>precise</span>
                          <span>creative</span>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                          max tokens
                        </label>
                        <input
                          type="number"
                          className="term-input"
                          style={{ fontSize: 12 }}
                          value={form.maxTokens}
                          min={1}
                          max={200000}
                          onChange={(e) => setForm((p) => ({ ...p, maxTokens: parseInt(e.target.value, 10) || 4096 }))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* test panel */}
                {agent?.id && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 10,
                        color: 'var(--text-dim)',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        width: '100%',
                        textAlign: 'left',
                      }}
                      onClick={() => setTestOpen((v) => !v)}
                      aria-expanded={testOpen}
                    >
                      <span>{testOpen ? '▾' : '▸'}</span> test agent
                    </button>
                    {testOpen && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            className="term-input"
                            style={{ flex: 1, fontSize: 12 }}
                            value={testInput}
                            placeholder="send a test message…"
                            onChange={(e) => setTestInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !isTesting) handleTest();
                            }}
                            aria-label="test message"
                          />
                          <button
                            className="term-btn"
                            style={{ whiteSpace: 'nowrap' }}
                            disabled={!testInput.trim() || isTesting}
                            onClick={handleTest}
                          >
                            {isTesting ? 'running…' : 'run ↵'}
                          </button>
                        </div>
                        {testResult && (
                          <div
                            className="term-panel"
                            style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
                          >
                            <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                              {testResult.response}
                            </div>
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-dim)' }}>
                              <span>in {testResult.input_tokens} / out {testResult.output_tokens} tokens</span>
                              <span>{formatCost(testResult.cost)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* publish / unpublish section */}
                {agent?.id && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 10,
                        color: 'var(--text-dim)',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        width: '100%',
                        textAlign: 'left',
                      }}
                      onClick={() => setPublishOpen((v) => !v)}
                      aria-expanded={publishOpen}
                    >
                      <span>{publishOpen ? '▾' : '▸'}</span> community
                    </button>
                    {publishOpen && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {agent.isPublished ? (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            <span className="pill active" style={{ marginRight: 8 }}>published</span>
                            this agent is live on the community tab
                          </div>
                        ) : (
                          <>
                            <textarea
                              className="term-textarea"
                              style={{ fontSize: 12 }}
                              rows={3}
                              value={publicDesc}
                              placeholder="public description (shown to other users)…"
                              onChange={(e) => setPublicDesc(e.target.value)}
                              aria-label="public description"
                            />
                          </>
                        )}
                        {/* publish/unpublish buttons rendered in footer */}
                      </div>
                    )}
                  </div>
                )}

                {/* delete zone */}
                {agent?.id && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    {!deleteConfirm ? (
                      <button
                        className="term-btn ghost"
                        style={{ fontSize: 11 }}
                        onClick={() => setDeleteConfirm(true)}
                      >
                        delete agent
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>confirm delete?</span>
                        <button
                          className="term-btn"
                          style={{ fontSize: 11 }}
                          onClick={async () => {
                            await onDelete();
                            setDeleteConfirm(false);
                          }}
                        >
                          yes, delete
                        </button>
                        <button
                          className="term-btn ghost"
                          style={{ fontSize: 11 }}
                          onClick={() => setDeleteConfirm(false)}
                        >
                          cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        {!isPreset && (
          <div
            style={{
              borderTop: '1px solid var(--border)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: publishOpen && agent?.id ? 'space-between' : 'flex-end',
            }}
          >
            {/* publish / unpublish action only when publish section open */}
            {publishOpen && agent?.id && (
              <div style={{ display: 'flex', gap: 8 }}>
                {agent.isPublished ? (
                  <button
                    className="term-btn ghost"
                    style={{ fontSize: 11 }}
                    disabled={isPublishing}
                    onClick={async () => {
                      setIsPublishing(true);
                      try {
                        const { unpublishAgent } = await import('@/lib/dash/api');
                        await unpublishAgent(agent.id);
                        // reload to reflect new state - parent handles
                      } catch {
                        // toast from request()
                      } finally {
                        setIsPublishing(false);
                      }
                    }}
                  >
                    {isPublishing ? 'unpublishing…' : 'unpublish'}
                  </button>
                ) : (
                  <button
                    className="term-btn ghost"
                    style={{ fontSize: 11 }}
                    disabled={isPublishing || !publicDesc.trim()}
                    onClick={async () => {
                      if (!publicDesc.trim()) return;
                      setIsPublishing(true);
                      try {
                        const { publishAgent } = await import('@/lib/dash/api');
                        await publishAgent(agent.id, publicDesc.trim());
                      } catch {
                        // toast from request()
                      } finally {
                        setIsPublishing(false);
                      }
                    }}
                  >
                    {isPublishing ? 'publishing…' : 'publish →'}
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="term-btn ghost" onClick={onClose}>
                cancel
              </button>
              <button
                className="term-btn"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? 'saving…' : agent ? 'save changes' : 'create agent'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
