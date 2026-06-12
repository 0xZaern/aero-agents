'use client';

import type { ActivityEntry, ActivityKind, AgentId } from '@/lib/dash/usageData';
import { formatCost } from '@/lib/dash/utils';

/** Relative time label — deterministic (no Date.now(), uses a fixed reference). */
function relativeTime(iso: string): string {
  const ref = new Date('2026-06-12T18:32:00Z').getTime();
  const ms = ref - new Date(iso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function kindIcon(kind: ActivityKind): string {
  switch (kind) {
    case 'run_complete':    return '✓';
    case 'run_failed':      return '✕';
    case 'run_started':     return '▶';
    case 'token_milestone': return '⟡';
  }
}

function kindColor(kind: ActivityKind): string {
  switch (kind) {
    case 'run_complete':    return 'var(--t-accent)';
    case 'run_failed':      return '#f87171';
    case 'run_started':     return 'var(--t-muted)';
    case 'token_milestone': return 'var(--t-text)';
  }
}

interface ActivityFeedProps {
  activity: ActivityEntry[];
  filteredAgents: AgentId[] | null; // null = show all
  loading: boolean;
}

const PAGE_SIZE = 12;

export function ActivityFeed({ activity, filteredAgents, loading }: ActivityFeedProps) {
  // Filter by selected agents
  const filtered = filteredAgents
    ? activity.filter((e) => filteredAgents.includes(e.agentId))
    : activity;

  const visible = filtered.slice(0, PAGE_SIZE);

  return (
    <div className="term-panel" role="region" aria-label="Recent activity feed">
      <div className="term-panel-head" style={{ justifyContent: 'space-between' }}>
        <span>recent activity</span>
        <span style={{ fontSize: 10, color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>
          {filtered.length} events
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: 44,
                background: 'var(--t-hover)',
                borderRadius: 'var(--t-radius-sm)',
                animation: 'term-dots 1.4s infinite',
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div
          className="term-empty"
          style={{ height: 140 }}
          aria-live="polite"
        >
          <div className="big">no activity</div>
          <div>adjust the filter to see events</div>
        </div>
      ) : (
        <ul
          style={{ listStyle: 'none', padding: 0, margin: 0 }}
          aria-live="polite"
        >
          {visible.map((entry, idx) => {
            const isLast = idx === visible.length - 1;
            return (
              <li
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '10px 16px',
                  borderBottom: isLast ? 'none' : '1px solid var(--t-border)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'var(--t-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = ''; }}
              >
                {/* Kind icon */}
                <div
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: '1px solid var(--t-border-2)',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-m)',
                    fontSize: 10,
                    color: kindColor(entry.kind),
                    background: 'var(--t-bg)',
                    marginTop: 1,
                  }}
                >
                  {kindIcon(entry.kind)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--t-text)',
                      lineHeight: 1.4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {entry.description}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      display: 'flex',
                      gap: 12,
                      fontFamily: 'var(--font-m)',
                      fontSize: 10,
                      color: 'var(--t-dim)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{relativeTime(entry.timestamp)}</span>
                    {entry.tokens !== null && (
                      <span>
                        {entry.tokens >= 1000
                          ? `${(entry.tokens / 1000).toFixed(1)}K`
                          : entry.tokens}{' '}
                        tokens
                      </span>
                    )}
                    {entry.costUsd !== null && <span>{formatCost(entry.costUsd)}</span>}
                  </div>
                </div>

                {/* Agent tag */}
                <div
                  style={{
                    flexShrink: 0,
                    padding: '2px 8px',
                    border: '1px solid var(--t-border)',
                    borderRadius: 'var(--t-radius-sm)',
                    fontFamily: 'var(--font-m)',
                    fontSize: 10,
                    color: 'var(--t-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.agentName}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > PAGE_SIZE && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--t-border)',
            fontFamily: 'var(--font-m)',
            fontSize: 11,
            color: 'var(--t-dim)',
            textAlign: 'center',
          }}
        >
          showing {PAGE_SIZE} of {filtered.length} events
        </div>
      )}
    </div>
  );
}
