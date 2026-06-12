'use client';

import { useCallback, useEffect, useState } from 'react';
import { getUsageData, type UsageData, type DateWindow, type AgentId } from '@/lib/dash/usageData';
import { AGENT_META } from '@/lib/dash/usageData';
import { UsageStatCards } from '@/components/dash/usage/UsageStatCards';
import { UsageChart } from '@/components/dash/usage/UsageChart';
import { AgentBreakdown } from '@/components/dash/usage/AgentBreakdown';
import { ActivityFeed } from '@/components/dash/usage/ActivityFeed';
import { UsageFilters } from '@/components/dash/usage/UsageFilters';

const ALL_AGENT_IDS = Object.keys(AGENT_META) as AgentId[];

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState<DateWindow>('7d');

  // null = all agents; array = specific selection
  const [selectedAgents, setSelectedAgents] = useState<AgentId[] | null>(null);

  const load = useCallback(async (w: DateWindow) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUsageData(w);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(window); }, [load, window]);

  function handleWindowChange(w: DateWindow) {
    setWindow(w);
  }

  function handleAgentToggle(id: AgentId) {
    setSelectedAgents((prev) => {
      // If currently "all", start a selection with this one agent
      if (prev === null) return [id];
      const has = prev.includes(id);
      if (has) {
        // Deselecting — remove it
        const next = prev.filter((a) => a !== id);
        // If nothing left, revert to "all"
        return next.length === 0 ? null : next;
      } else {
        // Selecting — add it
        const next = [...prev, id];
        // If we now have all agents selected, simplify to null (= all)
        return next.length === ALL_AGENT_IDS.length ? null : next;
      }
    });
  }

  function handleClearAgents() {
    setSelectedAgents(null);
  }

  return (
    <div
      className="term-scroll"
      style={{ position: 'absolute', inset: 0 }}
      aria-label="Usage and activity dashboard"
    >
      <div
        className="term-pad"
        style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980, margin: '0 auto' }}
      >
        {/* Page header */}
        <div className="term-page-head" style={{ marginBottom: 6 }}>
          <div>
            <h1>usage &amp; activity</h1>
            <div className="sub" style={{ marginTop: 2 }}>
              {data ? data.windowLabel : 'loading…'}
              {data && !loading && (
                <span style={{ marginLeft: 8, color: 'var(--t-accent)', fontFamily: 'var(--font-m)', fontSize: 11 }}>
                  ·{' '}
                  <span aria-live="polite">
                    {data.totals.runs.toLocaleString()} runs
                  </span>
                </span>
              )}
            </div>
          </div>
          <span className="spacer" style={{ flex: 1 }} />
          <button
            className="term-btn ghost"
            style={{ fontSize: 11, padding: '6px 12px' }}
            onClick={() => void load(window)}
            disabled={loading}
            aria-label="Refresh usage data"
          >
            {loading ? '···' : 'refresh'}
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              border: '1px solid var(--t-border-2)',
              borderRadius: 'var(--t-radius-sm)',
              color: '#f87171',
              fontSize: 12,
              fontFamily: 'var(--font-m)',
            }}
          >
            err: {error}{' '}
            <button
              onClick={() => void load(window)}
              style={{
                color: 'var(--t-muted)',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-m)',
                fontSize: 12,
              }}
            >
              retry
            </button>
          </div>
        )}

        {/* Filters */}
        <UsageFilters
          window={window}
          onWindowChange={handleWindowChange}
          selectedAgents={selectedAgents}
          onAgentToggle={handleAgentToggle}
          onClearAgents={handleClearAgents}
          loading={loading}
        />

        {/* Stat cards */}
        <UsageStatCards data={data} loading={loading} />

        {/* Chart */}
        <UsageChart
          daily={data?.daily ?? []}
          filteredAgents={selectedAgents}
          loading={loading}
        />

        {/* Two-column lower section: agent breakdown + activity feed */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)',
            gap: 14,
            alignItems: 'start',
          }}
        >
          <AgentBreakdown
            agents={data?.agents ?? []}
            selectedAgents={selectedAgents}
            onToggleAgent={handleAgentToggle}
            loading={loading}
          />
          <ActivityFeed
            activity={data?.activity ?? []}
            filteredAgents={selectedAgents}
            loading={loading}
          />
        </div>

        {/* Empty state (only when loaded + actually empty) */}
        {!loading && data && data.totals.runs === 0 && (
          <div className="term-empty" style={{ height: 220 }}>
            <div className="big">user@aero:~/usage$</div>
            <div>
              no agent runs in this window — start a session to see analytics
              <span className="term-caret" />
            </div>
          </div>
        )}
      </div>

      {/* Mobile: stack agent breakdown below activity on small screens */}
      <style>{`
        @media (max-width: 700px) {
          .usage-lower-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
