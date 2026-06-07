'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelExecution, getExecution, runCrew } from '@/lib/dash/api';
import type { Crew, CrewExecution, ExecutionStep } from '@/lib/dash/types';
import { formatCost } from '@/lib/dash/utils';

interface RunPanelProps {
  crew: Crew;
  onClose: () => void;
  /** Called when execution completes so history can refresh */
  onDone: () => void;
}

type PanelView = 'prompt' | 'running';

export default function RunPanel({ crew, onClose, onDone }: RunPanelProps) {
  const [view, setView] = useState<PanelView>('prompt');
  const [task, setTask] = useState('');
  const [taskError, setTaskError] = useState('');
  const [launching, setLaunching] = useState(false);

  // Execution live state
  const [exec, setExec] = useState<CrewExecution | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 60);
  }, []);

  // Escape to close when in prompt view
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view === 'prompt') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, view]);

  // Auto-scroll log to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [exec?.executionLog]);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleRun() {
    if (!task.trim()) {
      setTaskError('task description is required');
      return;
    }
    setTaskError('');
    setLaunching(true);
    try {
      const result = await runCrew(crew.id, task.trim());
      setExec(result);
      setView('running');
      startPolling(result.id);
    } catch {
      // request() handles toast
    } finally {
      setLaunching(false);
    }
  }

  function startPolling(executionId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const updated = await getExecution(executionId);
        setExec(updated);
        if (updated.status !== 'running') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          onDone();
        }
      } catch {
        clearInterval(pollRef.current!);
        pollRef.current = null;
      }
    }, 2000);
  }

  async function handleCancel() {
    if (!exec) return;
    setCancelling(true);
    try {
      await cancelExecution(exec.id);
      // poll will pick up the cancelled status
    } catch {
      // silently handled
    } finally {
      setCancelling(false);
    }
  }

  const isDone = exec && exec.status !== 'running';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={view === 'prompt' ? onClose : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.55)',
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`run: ${crew.name}`}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          zIndex: 50,
          background: 'var(--bg)',
          border: '1px solid var(--border-strong)',
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* Header */}
        <div
          className="term-panel-head"
          style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border-strong)' }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {view === 'prompt' ? `> run: ${crew.name}` : `> exec: ${crew.name}`}
          </span>
          {(view === 'prompt' || isDone) && (
            <button
              className="term-btn ghost"
              style={{ padding: '3px 8px', fontSize: 11, flexShrink: 0 }}
              onClick={onClose}
              aria-label="close"
            >
              ✕
            </button>
          )}
        </div>

        {view === 'prompt' && (
          <>
            <div className="term-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                task description
              </div>
              <textarea
                ref={textRef}
                className="term-textarea term-prompt"
                rows={4}
                value={task}
                onChange={(e) => {
                  setTask(e.target.value);
                  if (taskError) setTaskError('');
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void handleRun();
                  }
                }}
                placeholder="describe what you want this team to accomplish…"
              />
              {taskError && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>! {taskError}</span>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ctrl+enter to run</div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                padding: '10px 18px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <button className="term-btn ghost" onClick={onClose} disabled={launching}>
                cancel
              </button>
              <button
                className="term-btn"
                onClick={handleRun}
                disabled={launching || !task.trim()}
              >
                {launching ? 'launching…' : '▶ run team'}
              </button>
            </div>
          </>
        )}

        {view === 'running' && exec && (
          <div className="term-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Status bar inside modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 14px',
              borderBottom: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--text-dim)',
            }}>
              <StatusPill status={exec.status} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                {exec.taskDescription}
              </span>
              {exec.totalCost != null && exec.totalCost > 0 && (
                <span>{formatCost(exec.totalCost)}</span>
              )}
              {exec.totalTokens != null && exec.totalTokens > 0 && (
                <span>{exec.totalTokens.toLocaleString()} tok</span>
              )}
            </div>

            {/* Execution log */}
            <div className="term-scroll term-pad" style={{ flex: 1 }}>
              {exec.executionLog.length === 0 && exec.status === 'running' && (
                <div className="term-empty" style={{ height: 'auto', padding: '24px 0' }}>
                  <div className="big">
                    initializing team<span className="term-caret" />
                  </div>
                </div>
              )}

              {exec.executionLog.map((step, idx) => (
                <StepRow
                  key={`${step.agentId}-${idx}`}
                  step={step}
                  index={idx}
                  isLast={idx === exec.executionLog.length - 1}
                />
              ))}

              {/* Final result */}
              {exec.status === 'completed' && exec.result && (
                <div
                  className="term-panel"
                  style={{ marginTop: 16 }}
                >
                  <div className="term-panel-head">
                    <span>result</span>
                  </div>
                  <div style={{ padding: 14, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text)', lineHeight: 1.65 }}>
                    {exec.result}
                  </div>
                </div>
              )}

              {exec.status === 'failed' && (
                <div style={{ marginTop: 12, padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, color: 'var(--text-muted)', fontSize: 12 }}>
                  ! execution failed
                </div>
              )}

              {exec.status === 'cancelled' && (
                <div style={{ marginTop: 12, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-dim)', fontSize: 12 }}>
                  execution cancelled
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Footer controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '10px 18px',
              borderTop: '1px solid var(--border)',
            }}>
              {!isDone && (
                <button
                  className="term-btn ghost"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? 'cancelling…' : '■ cancel'}
                </button>
              )}
              {isDone && (
                <button className="term-btn" onClick={onClose}>
                  close
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatusPill({ status }: { status: CrewExecution['status'] }) {
  const map: Record<CrewExecution['status'], string> = {
    running: 'running',
    completed: 'success',
    failed: 'error',
    cancelled: 'paused',
  };
  return <span className={`pill ${map[status]}`}>{status}</span>;
}

function StepRow({
  step,
  index,
  isLast,
}: {
  step: ExecutionStep;
  index: number;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const stepMap: Record<ExecutionStep['status'], string> = {
    waiting: 'paused',
    running: 'running',
    completed: 'success',
    failed: 'error',
  };

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 4 }}>
      {/* Index column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 20,
          height: 20,
          border: '1px solid var(--border-strong)',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          color: step.status === 'completed' ? 'var(--text)' : 'var(--text-dim)',
          background: step.status === 'running' ? 'var(--surface)' : 'transparent',
        }}>
          {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : index + 1}
        </div>
        {!isLast && (
          <div style={{ width: 1, flex: 1, minHeight: 12, background: 'var(--border)', marginTop: 3 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 10, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 12,
            color: step.status === 'waiting' ? 'var(--text-dim)' : 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {step.agentName}
          </span>
          <span className={`pill ${stepMap[step.status]}`}>{step.status}</span>
          {step.status === 'running' && <span className="term-caret" style={{ width: 6, height: '0.8em' }} />}
        </div>

        {step.action && step.action !== 'run' && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {step.action}
          </div>
        )}

        {(step.tokens != null && step.tokens > 0 || step.cost != null && step.cost > 0) && (
          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
            {step.tokens != null && step.tokens > 0 && <span>{step.tokens.toLocaleString()} tok</span>}
            {step.cost != null && step.cost > 0 && <span>{formatCost(step.cost)}</span>}
          </div>
        )}

        {step.output && (step.status === 'completed' || step.status === 'failed') && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                fontSize: 10,
                color: 'var(--text-dim)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.04em',
              }}
            >
              {expanded ? '▾ hide output' : '▸ show output'}
            </button>
            {expanded && (
              <div style={{
                marginTop: 6,
                padding: '8px 10px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 2,
                fontSize: 11,
                color: 'var(--text-muted)',
                whiteSpace: 'pre-wrap',
                maxHeight: 200,
                overflowY: 'auto',
                lineHeight: 1.6,
              }}>
                {step.output}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
