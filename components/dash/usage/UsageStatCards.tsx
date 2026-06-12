'use client';

import type { UsageData } from '@/lib/dash/usageData';
import { formatCost } from '@/lib/dash/utils';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  loading: boolean;
}

function StatCard({ label, value, sub, loading }: StatCardProps) {
  return (
    <div className="term-panel" style={{ flex: 1, minWidth: 0 }}>
      <div className="term-panel-head">{label}</div>
      <div style={{ padding: '14px 16px 16px' }}>
        {loading ? (
          <div
            style={{
              height: 28,
              width: '60%',
              background: 'var(--t-hover)',
              borderRadius: 'var(--t-radius-sm)',
              animation: 'term-dots 1.4s infinite',
            }}
          />
        ) : (
          <>
            <div
              style={{
                fontSize: 26,
                fontFamily: 'var(--font-m)',
                color: 'var(--t-accent)',
                letterSpacing: '0.02em',
                lineHeight: 1.15,
              }}
            >
              {value}
            </div>
            {sub && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: 'var(--t-dim)',
                  fontFamily: 'var(--font-m)',
                }}
              >
                {sub}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface UsageStatCardsProps {
  data: UsageData | null;
  loading: boolean;
}

export function UsageStatCards({ data, loading }: UsageStatCardsProps) {
  const t = data?.totals;

  return (
    <div
      style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
      role="region"
      aria-label="Usage summary statistics"
    >
      <StatCard
        label="total runs"
        value={t ? t.runs.toLocaleString() : '—'}
        sub={data ? `across ${data.agents.length} agents` : undefined}
        loading={loading}
      />
      <StatCard
        label="input tokens"
        value={t ? fmtTokens(t.inputTokens) : '—'}
        sub={t ? (fmtTokens(Math.round(t.inputTokens / Math.max(t.runs, 1))) + '/run avg') : undefined}
        loading={loading}
      />
      <StatCard
        label="output tokens"
        value={t ? fmtTokens(t.outputTokens) : '—'}
        sub={t ? ('ratio ' + (t.outputTokens / Math.max(t.inputTokens, 1)).toFixed(2)) : undefined}
        loading={loading}
      />
      <StatCard
        label="total cost"
        value={t ? formatCost(t.costUsd) : '—'}
        sub={t ? (formatCost(t.costUsd / Math.max(t.runs, 1)) + '/run avg') : undefined}
        loading={loading}
      />
    </div>
  );
}
