'use client';

import { useState, useId } from 'react';
import type { DailyAgentUsage, AgentId } from '@/lib/dash/usageData';
import { formatCost } from '@/lib/dash/utils';

type Metric = 'runs' | 'tokens' | 'cost';

interface UsageChartProps {
  daily: DailyAgentUsage[];
  filteredAgents: AgentId[] | null; // null = all agents
  loading: boolean;
}

/** Short month/day label from an ISO date string. */
function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function fmtValue(v: number, metric: Metric): string {
  if (metric === 'cost') return formatCost(v);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

export function UsageChart({ daily, filteredAgents, loading }: UsageChartProps) {
  const [metric, setMetric] = useState<Metric>('runs');
  const [hovered, setHovered] = useState<number | null>(null);
  const tooltipId = useId();

  if (loading) {
    return (
      <div className="term-panel">
        <div className="term-panel-head">daily usage</div>
        <div
          style={{
            height: 160,
            margin: 18,
            background: 'var(--t-hover)',
            borderRadius: 'var(--t-radius-sm)',
            animation: 'term-dots 1.4s infinite',
          }}
        />
      </div>
    );
  }

  // Aggregate daily rows to one value per date, filtered by selected agents.
  const dates = Array.from(new Set(daily.map((r) => r.date))).sort();
  const byDate: Record<string, number> = {};
  for (const row of daily) {
    if (filteredAgents && !filteredAgents.includes(row.agentId)) continue;
    const v =
      metric === 'runs'
        ? row.runs
        : metric === 'tokens'
        ? row.inputTokens + row.outputTokens
        : row.costUsd;
    byDate[row.date] = (byDate[row.date] ?? 0) + v;
  }

  const values = dates.map((d) => byDate[d] ?? 0);
  const maxVal = Math.max(...values, 0.0001);

  // SVG dimensions
  const W = 600;
  const H = 100;
  const PAD_L = 0;
  const PAD_B = 0;
  const barW = Math.max(1, (W - PAD_L) / Math.max(dates.length, 1) - 2);

  // Build a polyline for the line chart overlay
  const points = values.map((v, i) => {
    const x = PAD_L + i * ((W - PAD_L) / Math.max(dates.length - 1, 1));
    const y = H - PAD_B - (v / maxVal) * (H - PAD_B - 8);
    return `${x},${y}`;
  });

  const METRICS: { key: Metric; label: string }[] = [
    { key: 'runs',   label: 'runs' },
    { key: 'tokens', label: 'tokens' },
    { key: 'cost',   label: 'cost' },
  ];

  return (
    <div className="term-panel" role="region" aria-label="Daily usage chart">
      <div className="term-panel-head" style={{ justifyContent: 'space-between' }}>
        <span>daily usage</span>
        <div role="group" aria-label="Select metric" style={{ display: 'flex', gap: 4 }}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              style={{
                padding: '2px 9px',
                borderRadius: 'var(--t-radius-sm)',
                border: '1px solid',
                borderColor: metric === m.key ? 'var(--t-accent-dim)' : 'var(--t-border)',
                background: metric === m.key ? 'var(--t-accent-soft)' : 'transparent',
                color: metric === m.key ? 'var(--t-accent)' : 'var(--t-dim)',
                fontFamily: 'var(--font-m)',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 18px 18px', position: 'relative' }}>
        {values.every((v) => v === 0) ? (
          <div
            style={{
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--t-dim)',
              fontFamily: 'var(--font-m)',
              fontSize: 12,
            }}
          >
            no data for selection
          </div>
        ) : (
          <>
            {/* Bar chart rendered via SVG */}
            <svg
              viewBox={`0 0 ${W} ${H}`}
              aria-hidden="true"
              style={{ width: '100%', height: 120, overflow: 'visible', display: 'block' }}
              preserveAspectRatio="none"
            >
              {/* Y-axis gridlines */}
              {[0.25, 0.5, 0.75, 1].map((frac) => {
                const y = H - PAD_B - frac * (H - PAD_B - 8);
                return (
                  <line
                    key={frac}
                    x1={0}
                    y1={y}
                    x2={W}
                    y2={y}
                    stroke="var(--t-border)"
                    strokeWidth={0.5}
                  />
                );
              })}

              {/* Bars */}
              {values.map((v, i) => {
                const barH = Math.max(2, (v / maxVal) * (H - PAD_B - 8));
                const x = PAD_L + i * ((W - PAD_L) / Math.max(dates.length, 1)) + 1;
                const y = H - PAD_B - barH;
                const isHov = hovered === i;
                return (
                  <rect
                    key={dates[i]}
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx={2}
                    fill={isHov ? 'var(--t-text)' : 'var(--t-accent)'}
                    opacity={isHov ? 1 : 0.7}
                    style={{ transition: 'opacity 0.12s, fill 0.12s', cursor: 'default' }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    aria-describedby={tooltipId}
                  />
                );
              })}

              {/* Line overlay */}
              {values.length > 1 && (
                <polyline
                  points={points.join(' ')}
                  fill="none"
                  stroke="var(--t-accent)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.35}
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </svg>

            {/* Tooltip */}
            <div
              id={tooltipId}
              aria-live="polite"
              style={{
                minHeight: 18,
                marginTop: 8,
                fontFamily: 'var(--font-m)',
                fontSize: 11,
                color: hovered !== null ? 'var(--t-text)' : 'var(--t-dim)',
              }}
            >
              {hovered !== null
                ? `${shortDate(dates[hovered])} · ${fmtValue(values[hovered], metric)}`
                : ' '}
            </div>

            {/* X-axis labels */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
                fontFamily: 'var(--font-m)',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>
                {dates[0] ? shortDate(dates[0]) : ''}
              </span>
              {dates.length > 2 && (
                <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>
                  {shortDate(dates[Math.floor(dates.length / 2)])}
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>
                {dates.length > 0 ? shortDate(dates[dates.length - 1]) : ''}
              </span>
            </div>

            {/* Y-axis hint */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 8,
                borderTop: '1px solid var(--t-border)',
                paddingTop: 8,
                fontFamily: 'var(--font-m)',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>0</span>
              <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>
                peak {fmtValue(maxVal, metric)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
