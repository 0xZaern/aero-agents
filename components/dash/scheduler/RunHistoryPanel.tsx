'use client';

import { useEffect, useState } from 'react';
import { useScheduledTasksStore } from '@/lib/dash/stores/scheduledTasksStore';
import { formatRelativePast } from '@/lib/dash/scheduleFormat';
import { formatCost } from '@/lib/dash/utils';
import type { ScheduledTask, ScheduledRun, ScheduledRunStatus } from '@/lib/dash/scheduler';

// ── helpers ───────────────────────────────────────────────────────────────────

function pillClass(status: ScheduledRunStatus): string {
  switch (status) {
    case 'success': return 'pill success';
    case 'failed': return 'pill error';
    case 'failed_retrying': return 'pill error';
    case 'running': return 'pill running';
    case 'skipped_cost_cap':
    case 'skipped_no_credit':
    case 'skipped_no_new_items': return 'pill paused';
    default: return 'pill';
  }
}

function pillLabel(status: ScheduledRunStatus): string {
  switch (status) {
    case 'success': return 'ok';
    case 'failed': return 'failed';
    case 'failed_retrying': return 'retrying';
    case 'running': return 'running';
    case 'skipped_cost_cap': return 'cost cap';
    case 'skipped_no_credit': return 'no credit';
    case 'skipped_no_new_items': return 'no change';
    default: return status;
  }
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) return '';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── run row ───────────────────────────────────────────────────────────────────

function RunRow({ run }: { run: ScheduledRun }) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = !!(run.output_text ?? run.error_message);

  return (
    <tr
      style={{ cursor: hasContent ? 'pointer' : 'default' }}
      onClick={() => hasContent && setExpanded((p) => !p)}
    >
      <td style={{ color: 'var(--text-dim)', fontSize: 11 }}>
        {formatRelativePast(run.started_at) || '-'}
      </td>
      <td>
        <span className={pillClass(run.status)}>{pillLabel(run.status)}</span>
      </td>
      <td style={{ color: 'var(--text-dim)', fontSize: 11 }}>
        {formatDuration(run.started_at, run.finished_at)}
      </td>
      <td style={{ color: 'var(--text-dim)', fontSize: 11 }}>
        {run.cost_usd > 0 ? formatCost(run.cost_usd) : ''}
      </td>
      <td style={{ color: 'var(--text-dim)', fontSize: 11, maxWidth: 260 }}>
        {expanded && run.error_message ? (
          <span style={{ color: 'var(--text-muted)' }}>{run.error_message}</span>
        ) : expanded && run.output_text ? (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {run.output_text.slice(0, 400)}{run.output_text.length > 400 ? '…' : ''}
          </span>
        ) : hasContent ? (
          <span style={{ opacity: 0.5 }}>{expanded ? '▲ collapse' : '▶ expand'}</span>
        ) : null}
      </td>
    </tr>
  );
}

// ── panel ─────────────────────────────────────────────────────────────────────

interface RunHistoryPanelProps {
  task: ScheduledTask;
  onClose: () => void;
}

export function RunHistoryPanel({ task, onClose }: RunHistoryPanelProps) {
  const { runs, fetchRuns } = useScheduledTasksStore();
  const [loading, setLoading] = useState(false);
  const taskRuns = runs[task.id] ?? [];

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    fetchRuns(task.id, 20).finally(() => setLoading(false));
  }, [task.id, fetchRuns]);

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* slide-in panel from right */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Run history: ${task.title}`}
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0,
          width: 520, zIndex: 50,
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div className="term-panel-head" style={{ padding: '10px 14px', justifyContent: 'space-between' }}>
          <span>
            run history
            <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
              / {task.title}
            </span>
          </span>
          <button
            className="term-btn ghost"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '2px 8px', fontSize: 11 }}
          >
            ✕
          </button>
        </div>

        {/* content */}
        <div className="term-scroll" style={{ flex: 1 }}>
          {loading && taskRuns.length === 0 ? (
            <div className="term-empty" style={{ height: 200 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                loading<span className="term-caret" />
              </div>
            </div>
          ) : taskRuns.length === 0 ? (
            <div className="term-empty" style={{ height: 200 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>no runs yet</div>
            </div>
          ) : (
            <div style={{ padding: '0 14px 14px' }}>
              <table className="term-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>when</th>
                    <th>status</th>
                    <th>duration</th>
                    <th>cost</th>
                    <th>output</th>
                  </tr>
                </thead>
                <tbody>
                  {taskRuns.map((run) => (
                    <RunRow key={run.id} run={run} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
