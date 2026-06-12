'use client';

import type { AgentSummary, AgentId } from '@/lib/dash/usageData';
import { formatCost } from '@/lib/dash/utils';

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface AgentBreakdownProps {
  agents: AgentSummary[];
  selectedAgents: AgentId[] | null; // null = all
  onToggleAgent: (id: AgentId) => void;
  loading: boolean;
}

export function AgentBreakdown({
  agents,
  selectedAgents,
  onToggleAgent,
  loading,
}: AgentBreakdownProps) {
  if (loading) {
    return (
      <div className="term-panel">
        <div className="term-panel-head">per-agent breakdown</div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 38,
                background: 'var(--t-hover)',
                borderRadius: 'var(--t-radius-sm)',
                animation: 'term-dots 1.4s infinite',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (agents.length === 0) return null;

  const sorted = [...agents].sort((a, b) => b.totalRuns - a.totalRuns);

  function isSelected(id: AgentId): boolean {
    return selectedAgents === null || selectedAgents.includes(id);
  }

  return (
    <div className="term-panel" role="region" aria-label="Per-agent usage breakdown">
      <div className="term-panel-head" style={{ justifyContent: 'space-between' }}>
        <span>per-agent breakdown</span>
        <span
          style={{ fontSize: 10, color: 'var(--t-dim)', fontFamily: 'var(--font-m)', letterSpacing: '0.06em' }}
        >
          click row to filter
        </span>
      </div>

      <div className="term-table-wrap">
        <table className="term-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '22%' }}>agent</th>
              <th style={{ width: '12%', textAlign: 'right' }}>runs</th>
              <th style={{ width: '16%', textAlign: 'right' }}>in tokens</th>
              <th style={{ width: '16%', textAlign: 'right' }}>out tokens</th>
              <th style={{ width: '14%', textAlign: 'right' }}>cost</th>
              <th style={{ width: '20%' }}>share</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((agent) => {
              const active = isSelected(agent.agentId);
              return (
                <tr
                  key={agent.agentId}
                  onClick={() => onToggleAgent(agent.agentId)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`${agent.name} — ${active ? 'selected' : 'deselected'}. Click to toggle filter.`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleAgent(agent.agentId);
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    opacity: active ? 1 : 0.35,
                    transition: 'opacity 0.15s',
                    outline: 'none',
                  }}
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ color: active ? 'var(--t-accent)' : 'var(--t-muted)', fontWeight: 500 }}>
                        {agent.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--t-dim)',
                          fontFamily: 'var(--font-m)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {agent.role}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-m)',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--t-text)',
                    }}
                  >
                    {agent.totalRuns.toLocaleString()}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-m)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtTokens(agent.totalInputTokens)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-m)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtTokens(agent.totalOutputTokens)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-m)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCost(agent.totalCostUsd)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          background: 'var(--t-bg)',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.max(2, agent.costShare * 100).toFixed(1)}%`,
                            background: active ? 'var(--t-accent)' : 'var(--t-border-2)',
                            borderRadius: 3,
                            transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1), background 0.2s',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--t-dim)',
                          minWidth: 30,
                          textAlign: 'right',
                          fontFamily: 'var(--font-m)',
                        }}
                      >
                        {(agent.costShare * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
