'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScheduledTasksStore } from '@/lib/dash/stores/scheduledTasksStore';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import { formatNextRun, formatRelativePast } from '@/lib/dash/scheduleFormat';
import { formatCost } from '@/lib/dash/utils';
import { ScheduleLabel } from '@/components/dash/scheduler/ScheduleLabel';
import { PresetConfigModal } from '@/components/dash/scheduler/PresetConfigModal';
import { RunHistoryPanel } from '@/components/dash/scheduler/RunHistoryPanel';
import type { ScheduledTask, PresetDefinition } from '@/lib/dash/scheduler';
import type { FromPresetOverrides } from '@/lib/dash/scheduledTasks';

// ── helpers ───────────────────────────────────────────────────────────────────

type View = 'presets' | 'tasks';

/** Returns true when an error is a 403 from the API wrapper. */
function isForbidden(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status: number }).status === 403;
  }
  return false;
}

function taskStatusPillClass(status: ScheduledTask['status']): string {
  switch (status) {
    case 'active': return 'pill active';
    case 'paused': return 'pill paused';
    case 'error': return 'pill error';
    default: return 'pill';
  }
}

// ── delete confirm ────────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  task: ScheduledTask;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ task, onConfirm, onCancel }: DeleteConfirmProps) {
  // Escape cancels
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <>
      <div
        onClick={onCancel}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.5)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 90,
          width: 340, maxWidth: 'calc(100vw - 32px)',
          background: 'var(--t-elev)',
          border: '1px solid var(--t-border-2)',
          borderRadius: 'var(--t-radius)',
          boxShadow: 'var(--t-shadow-lg)',
          padding: 18,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--t-muted)' }}>
          <span style={{ color: 'var(--t-text)', fontWeight: 500 }}>delete task?</span>
          <br />
          <span style={{ color: 'var(--t-dim)' }}>
            &ldquo;{task.title}&rdquo; will be permanently removed.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="term-btn ghost" onClick={onCancel}>cancel</button>
          <button className="term-btn" onClick={onConfirm}>delete</button>
        </div>
      </div>
    </>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function SchedulerPage() {
  const router = useRouter();
  const isPro = useAuthStore((s) => s.isPro());
  const {
    tasks,
    presets,
    capabilities,
    isLoading,
    presetsLoading,
    runningTaskIds,
    fetchAll,
    fetchCapabilities,
    fetchPresets,
    createFromPreset,
    patch,
    remove,
    runNow,
    markTaskSeen,
    isTaskUnread,
  } = useScheduledTasksStore();

  // Pro-gate: if any init call throws 403 we show the upgrade wall.
  const [proGated, setProGated] = useState(false);
  // Generic error banner (non-403 failures on load)
  const [loadError, setLoadError] = useState<string | null>(null);

  // Which half of the page is shown
  const [view, setView] = useState<View>('presets');

  // Preset config modal
  const [configPreset, setConfigPreset] = useState<PresetDefinition | null>(null);

  // Run history panel
  const [historyTask, setHistoryTask] = useState<ScheduledTask | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ScheduledTask | null>(null);

  // Inline action errors per task
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  // ── initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await Promise.all([
          fetchCapabilities(),
          fetchPresets(),
          fetchAll(),
        ]);
      } catch (err) {
        if (cancelled) return;
        if (isForbidden(err)) {
          setProGated(true);
        } else {
          setLoadError(err instanceof Error ? err.message : 'failed to load scheduler');
        }
      }
    }

    // fetchAll / fetchCapabilities both swallow some errors internally;
    // still check the aggregate result to catch any that surface.
    void init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Also check store error flag for fetchAll (it sets state.error)
  const storeError = useScheduledTasksStore((s) => s.error);

  // Poll tasks every 60s to keep next_run_at fresh
  useEffect(() => {
    if (proGated) return;
    const interval = setInterval(() => { fetchAll().catch(() => {}); }, 60_000);
    return () => clearInterval(interval);
  }, [proGated, fetchAll]);

  // ── actions ───────────────────────────────────────────────────────────────

  const handleCreateFromPreset = useCallback(
    async (config: Record<string, unknown>, overrides: FromPresetOverrides) => {
      if (!configPreset) return;
      await createFromPreset(configPreset.id, config, overrides);
      setConfigPreset(null);
      setView('tasks');
    },
    [configPreset, createFromPreset]
  );

  const handleRunNow = useCallback(
    async (task: ScheduledTask) => {
      try {
        await runNow(task.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'run failed';
        setActionErrors((prev) => ({ ...prev, [task.id]: msg }));
        setTimeout(() => setActionErrors((prev) => { const n = { ...prev }; delete n[task.id]; return n; }), 4000);
      }
    },
    [runNow]
  );

  const handleTogglePause = useCallback(
    async (task: ScheduledTask) => {
      const next = task.status === 'active' ? 'paused' : 'active';
      try {
        await patch(task.id, { status: next });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'update failed';
        setActionErrors((prev) => ({ ...prev, [task.id]: msg }));
        setTimeout(() => setActionErrors((prev) => { const n = { ...prev }; delete n[task.id]; return n; }), 4000);
      }
    },
    [patch]
  );

  const handleDelete = useCallback(
    async (task: ScheduledTask) => {
      setDeleteTarget(null);
      try {
        await remove(task.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'delete failed';
        setActionErrors((prev) => ({ ...prev, [task.id]: msg }));
        setTimeout(() => setActionErrors((prev) => { const n = { ...prev }; delete n[task.id]; return n; }), 4000);
      }
    },
    [remove]
  );

  const handleOpenHistory = useCallback(
    (task: ScheduledTask) => {
      markTaskSeen(task.id);
      setHistoryTask(task);
    },
    [markTaskSeen]
  );

  // ── pro gate ──────────────────────────────────────────────────────────────

  if (proGated) {
    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div className="term-empty">
          <div className="big">scheduler requires pro plan</div>
          <div style={{ color: 'var(--t-dim)', fontSize: 12, marginTop: 6 }}>
            upgrade in settings to unlock scheduled tasks
          </div>
        </div>
      </div>
    );
  }

  // ── layout ────────────────────────────────────────────────────────────────

  const displayError = loadError ?? storeError;
  const proRequired = /pro plan/i.test(displayError ?? '');
  // Pro-plan messages are shown inline (tasks need pro); only surface real errors.
  const realError = displayError && !proRequired ? displayError : null;

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── tab bar (location lives in the header) ── */}
      <div
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--t-border)',
          display: 'flex', alignItems: 'center', gap: 0,
          padding: '0 18px', height: 38,
        }}
      >
        {([['presets', 'presets'], ['tasks', `tasks (${tasks.length})`]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{
              padding: '0 14px', height: '100%', fontSize: 11,
              color: view === id ? 'var(--t-text)' : 'var(--t-dim)',
              borderBottom: view === id ? '1px solid var(--t-accent)' : '1px solid transparent',
              letterSpacing: '0.04em',
            }}
          >
            {label}
          </button>
        ))}
        {(isLoading || presetsLoading) && (
          <span style={{ marginLeft: 12, color: 'var(--t-dim)', fontSize: 11 }}>
            loading<span className="term-caret" />
          </span>
        )}
      </div>

      {/* ── real error banner (pro-plan notices are handled inline, not here) ── */}
      {realError && (
        <div style={{ flexShrink: 0, padding: '7px 18px', borderBottom: '1px solid var(--t-border)', fontSize: 11, color: '#f87171', background: 'var(--t-bg-2)' }}>
          error: {realError}
        </div>
      )}

      {/* ── scrollable body ── */}
      <div className="term-scroll" style={{ flex: 1 }}>
        <div className="term-pad">

          {!isPro && (
            <div className="term-panel" style={{ marginBottom: 14 }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--t-muted)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span style={{ flex: 1 }}>the scheduler is a PRO feature on the basic plan - browse presets here, upgrade to use them.</span>
                <button className="term-btn primary" style={{ fontSize: 11, padding: '4px 11px' }} onClick={() => router.push('/dashboard/billing')}>upgrade to pro</button>
              </div>
            </div>
          )}

          {/* ══ PRESETS VIEW ══ */}
          {view === 'presets' && (
            <>
              {/* capabilities notice */}
              {capabilities && !capabilities.twitter_source && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '6px 10px',
                    border: '1px solid var(--t-border)',
                    borderRadius: 2,
                    fontSize: 11,
                    color: 'var(--t-dim)',
                    background: 'var(--t-bg-2)',
                  }}
                >
                  note: twitter/x watch source is not configured on this server
                </div>
              )}

              {presetsLoading && presets.length === 0 ? (
                <PresetsLoadingSkeleton />
              ) : presets.length === 0 ? (
                <div className="term-empty" style={{ height: 240 }}>
                  <div style={{ color: 'var(--t-dim)', fontSize: 12 }}>no presets available</div>
                </div>
              ) : (
                <PresetGallery
                  presets={presets}
                  locked={!isPro}
                  onSelect={(preset) => {
                    if (!isPro) { router.push('/dashboard/billing'); return; } // locked on basic
                    setConfigPreset(preset);
                  }}
                />
              )}
            </>
          )}

          {/* ══ TASKS VIEW ══ */}
          {view === 'tasks' && (
            <>
              {isLoading && tasks.length === 0 ? (
                <div className="term-empty" style={{ height: 240 }}>
                  <div style={{ color: 'var(--t-dim)', fontSize: 12 }}>
                    loading tasks<span className="term-caret" />
                  </div>
                </div>
              ) : proRequired && tasks.length === 0 ? (
                <div className="term-empty" style={{ height: 280 }}>
                  <div className="big">scheduled tasks need pro</div>
                  <div style={{ color: 'var(--t-dim)', fontSize: 12, marginTop: 4 }}>
                    browse the presets below - upgrade in settings to activate them
                  </div>
                  <button className="term-btn" onClick={() => setView('presets')} style={{ marginTop: 12 }}>
                    browse presets
                  </button>
                </div>
              ) : tasks.length === 0 ? (
                <div className="term-empty" style={{ height: 260 }}>
                  <div className="big">no scheduled tasks</div>
                  <div style={{ color: 'var(--t-dim)', fontSize: 12, marginTop: 4 }}>
                    pick a preset to get started
                  </div>
                  <button
                    className="term-btn ghost"
                    onClick={() => setView('presets')}
                    style={{ marginTop: 12 }}
                  >
                    browse presets
                  </button>
                </div>
              ) : (
                <div className="term-grid">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isRunning={runningTaskIds.has(task.id)}
                      unread={isTaskUnread(task.id)}
                      actionError={actionErrors[task.id]}
                      onRun={() => handleRunNow(task)}
                      onTogglePause={() => handleTogglePause(task)}
                      onHistory={() => handleOpenHistory(task)}
                      onDelete={() => setDeleteTarget(task)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── modals / overlays ── */}

      {configPreset && (
        <PresetConfigModal
          preset={configPreset}
          capabilities={capabilities}
          onCreate={handleCreateFromPreset}
          onClose={() => setConfigPreset(null)}
        />
      )}

      {historyTask && (
        <RunHistoryPanel
          task={historyTask}
          onClose={() => setHistoryTask(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          task={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── preset gallery ─────────────────────────────────────────────────────────────

const CATEGORIES = ['all', 'news', 'crypto', 'weather', 'tech', 'personal'] as const;
type Category = (typeof CATEGORIES)[number];

function PresetGallery({
  presets,
  onSelect,
  locked,
}: {
  presets: PresetDefinition[];
  onSelect: (p: PresetDefinition) => void;
  locked?: boolean;
}) {
  const [filter, setFilter] = useState<Category>('all');

  const available = CATEGORIES.filter(
    (c) => c === 'all' || presets.some((p) => p.category === c)
  );

  const filtered =
    filter === 'all' ? presets : presets.filter((p) => p.category === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* category filter */}
      {available.length > 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {available.map((cat) => (
            <button
              key={cat}
              className={filter === cat ? 'term-btn' : 'term-btn ghost'}
              onClick={() => setFilter(cat)}
              style={{ padding: '3px 10px', fontSize: 11 }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* grid */}
      <div className="term-grid">
        {filtered.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            locked={locked}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  onSelect,
  locked,
}: {
  preset: PresetDefinition;
  onSelect: (p: PresetDefinition) => void;
  locked?: boolean;
}) {
  return (
    <button
      className="term-card"
      onClick={() => onSelect(preset)}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', width: '100%', opacity: locked ? 0.72 : 1 }}
    >
      {/* header: title + category chip / lock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span className="title" style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {preset.title}
        </span>
        {locked ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 11, letterSpacing: '0.04em', color: 'var(--t-dim)', whiteSpace: 'nowrap' }}>
            Only PRO
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
        ) : (
          <span className="term-chip" style={{ flexShrink: 0, fontSize: 9.5, padding: '2px 8px' }}>
            {preset.category}
          </span>
        )}
      </div>

      <p className="desc">{preset.description}</p>

      <div className="meta" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, fontFamily: 'var(--font-m)' }}>
        <span><ScheduleLabel schedule={preset.schedule} /></span>
        <span>~{formatCost(preset.estimated_cost_per_run_usd)} / run</span>
      </div>
    </button>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function PresetsLoadingSkeleton() {
  return (
    <div className="term-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="term-panel"
          style={{
            height: 110,
            opacity: 0.4,
            animation: 'term-dots 1.4s infinite',
          }}
        />
      ))}
    </div>
  );
}

// ── task card ───────────────────────────────────────────────────────────────

function SchedIcon({ d, title, onClick, disabled }: { d: string; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className="term-btn ghost"
      style={{ padding: 6, lineHeight: 0 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {d.split('|').map((p, i) => <path key={i} d={p} />)}
      </svg>
    </button>
  );
}

const ICON_PLAY = 'M6 4l14 8-14 8z';
const ICON_PAUSE = 'M7 4h3v16H7z|M14 4h3v16h-3z';
const ICON_CLOCK = 'M12 6v6l4 2|M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20';
const ICON_TRASH = 'M3 6h18|M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2';

interface TaskCardProps {
  task: ScheduledTask;
  isRunning: boolean;
  unread: boolean;
  actionError?: string;
  onRun: () => void;
  onTogglePause: () => void;
  onHistory: () => void;
  onDelete: () => void;
}

function TaskCard({ task, isRunning, unread, actionError, onRun, onTogglePause, onHistory, onDelete }: TaskCardProps) {
  const active = task.status === 'active';
  return (
    <div className="term-card" onClick={onHistory} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onHistory()} style={{ cursor: 'pointer' }}>
      {/* header: title + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {unread && <span aria-label="unread" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--t-accent)', flexShrink: 0 }} />}
          <span className="title" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
        </span>
        <span className={isRunning ? 'pill running' : taskStatusPillClass(task.status)} style={{ flexShrink: 0 }}>
          {isRunning ? 'running' : task.status}
        </span>
      </div>

      {/* schedule + timing (mono) */}
      <div className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: 'var(--font-m)' }}>
        <span><ScheduleLabel schedule={task.schedule} /></span>
        <span style={{ color: 'var(--t-dim)' }}>
          next: {formatNextRun(task.next_run_at)} · last: {formatRelativePast(task.last_run_at) || '-'}
        </span>
        {task.pause_reason && task.pause_reason !== 'user' && (
          <span style={{ color: 'var(--t-dim)' }}>paused: {task.pause_reason.replace('_', ' ')}</span>
        )}
        {actionError && <span style={{ color: '#f87171' }}>{actionError}</span>}
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 5, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
        <SchedIcon d={ICON_PLAY} title="run now" onClick={onRun} disabled={isRunning || task.status === 'error'} />
        <SchedIcon d={active ? ICON_PAUSE : ICON_PLAY} title={active ? 'pause' : 'resume'} onClick={onTogglePause} disabled={isRunning} />
        <SchedIcon d={ICON_CLOCK} title="run history" onClick={onHistory} />
        <span style={{ flex: 1 }} />
        <SchedIcon d={ICON_TRASH} title="delete" onClick={onDelete} disabled={isRunning} />
      </div>
    </div>
  );
}
