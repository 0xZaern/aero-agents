'use client';

import { useCallback, useEffect, useState } from 'react';
import { getExecution, listExecutions } from '@/lib/dash/api';
import type { CrewExecution } from '@/lib/dash/types';
import { formatCost } from '@/lib/dash/utils';

interface ExecHistoryProps {
  /** Bump this to trigger a refresh */
  refreshKey: number;
  crews: { id: string; name: string }[];
}

export default function ExecHistory({ refreshKey, crews }: ExecHistoryProps) {
  const [executions, setExecutions] = useState<CrewExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CrewExecution | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listExecutions();
      setExecutions(data);
    } catch {
      // request() handles toast
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function handleSelectRow(exec: CrewExecution) {
    if (selected?.id === exec.id) {
      setSelected(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const detail = await getExecution(exec.id);
      setSelected(detail);
    } catch {
      setSelected(exec); // fallback to list data
    } finally {
      setLoadingDetail(false);
    }
  }

  function crewName(crewId: string): string {
    return crews.find((c) => c.id === crewId)?.name ?? crewId.slice(0, 8);
  }

  const statusClass: Record<CrewExecution['status'], string> = {
    running: 'running',
    completed: 'success',
    failed: 'error',
    cancelled: 'paused',
  };

  return (
    <div className="term-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="term-panel-head" style={{ justifyContent: 'space-between' }}>
        <span>execution history</span>
        <button
          className="term-btn ghost"
          style={{ padding: '2px 8px', fontSize: 10 }}
          onClick={() => void load()}
          aria-label="refresh history"
        >
          refresh
        </button>
      </div>

      {loading ? (
        <div className="term-empty" style={{ padding: '28px 0' }}>
          <div>loading<span className="term-caret" /></div>
        </div>
      ) : executions.length === 0 ? (
        <div className="term-empty" style={{ padding: '28px 0' }}>
          <div className="big">no executions yet</div>
          <div style={{ fontSize: 11 }}>run a team to see history here</div>
        </div>
      ) : (
        <>
          <table className="term-table">
            <thead>
              <tr>
                <th>team</th>
                <th>status</th>
                <th>cost</th>
                <th>tokens</th>
                <th>started</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => {
                const isActive = selected?.id === exec.id;
                return (
                  <tr
                    key={exec.id}
                    onClick={() => void handleSelectRow(exec)}
                    style={{
                      cursor: 'pointer',
                      background: isActive ? 'var(--surface)' : undefined,
                    }}
                    title="click to view execution log"
                  >
                    <td style={{ color: isActive ? 'var(--text)' : undefined, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isActive ? '▸ ' : ''}{crewName(exec.crewId)}
                    </td>
                    <td>
                      <span className={`pill ${statusClass[exec.status]}`}>{exec.status}</span>
                    </td>
                    <td>{exec.totalCost != null && exec.totalCost > 0 ? formatCost(exec.totalCost) : '-'}</td>
                    <td>{exec.totalTokens != null && exec.totalTokens > 0 ? exec.totalTokens.toLocaleString() : '-'}</td>
                    <td>{new Date(exec.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Detail panel */}
          {selected && (
            <div style={{ borderTop: '1px solid var(--border)', padding: 14 }}>
              {loadingDetail ? (
                <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                  loading log<span className="term-caret" />
                </div>
              ) : (
                <ExecDetail exec={selected} onClose={() => setSelected(null)} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExecDetail({ exec, onClose }: { exec: CrewExecution; onClose: () => void }) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  function toggleStep(idx: number) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const statusClass: Record<CrewExecution['status'], string> = {
    running: 'running',
    completed: 'success',
    failed: 'error',
    cancelled: 'paused',
  };

  return (
    <div>
      {/* Detail header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className={`pill ${statusClass[exec.status]}`}>{exec.status}</span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {exec.taskDescription}
        </span>
        {exec.totalCost != null && exec.totalCost > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{formatCost(exec.totalCost)}</span>
        )}
        {exec.totalTokens != null && exec.totalTokens > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{exec.totalTokens.toLocaleString()} tok</span>
        )}
        <button
          className="term-btn ghost"
          style={{ padding: '2px 8px', fontSize: 10, flexShrink: 0 }}
          onClick={onClose}
        >
          close
        </button>
      </div>

      {/* Step list */}
      {exec.executionLog.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {exec.executionLog.map((step, idx) => {
            const expanded = expandedSteps.has(idx);
            const stepMap: Record<typeof step.status, string> = {
              waiting: 'paused',
              running: 'running',
              completed: 'success',
              failed: 'error',
            };
            return (
              <div
                key={`${step.agentId}-${idx}`}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  background: 'var(--bg-2)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    cursor: step.output ? 'pointer' : 'default',
                  }}
                  onClick={() => step.output && toggleStep(idx)}
                >
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 16, textAlign: 'center', flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {step.agentName}
                  </span>
                  <span className={`pill ${stepMap[step.status]}`} style={{ flexShrink: 0 }}>{step.status}</span>
                  {step.tokens != null && step.tokens > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{step.tokens.toLocaleString()} tok</span>
                  )}
                  {step.cost != null && step.cost > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{formatCost(step.cost)}</span>
                  )}
                  {step.output && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
                      {expanded ? '▾' : '▸'}
                    </span>
                  )}
                </div>
                {expanded && step.output && (
                  <div style={{
                    padding: '8px 10px',
                    borderTop: '1px solid var(--border)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 180,
                    overflowY: 'auto',
                    lineHeight: 1.6,
                  }}>
                    {step.output}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>no step log available</div>
      )}

      {/* Final result */}
      {exec.status === 'completed' && exec.result && (
        <div className="term-panel" style={{ marginTop: 14 }}>
          <div className="term-panel-head">result</div>
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto', lineHeight: 1.65 }}>
            {exec.result}
          </div>
        </div>
      )}
    </div>
  );
}
