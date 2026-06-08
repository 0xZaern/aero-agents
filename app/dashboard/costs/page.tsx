'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCostSummary } from '@/lib/dash/api';
import { formatCost } from '@/lib/dash/utils';
import type { CostSummary } from '@/lib/dash/types';

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── stat panel ──────────────────────────────────────────────────────────── */

function StatPanel({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="term-panel" style={{ flex: 1 }}>
      <div className="term-panel-head">{label}</div>
      <div style={{ padding: '18px 16px' }}>
        {loading ? (
          <div style={{ height: 30, width: 100, background: 'var(--t-hover)', borderRadius: 'var(--t-radius-sm)' }} />
        ) : (
          <span style={{ fontSize: 28, fontFamily: 'var(--font-m)', color: 'var(--t-accent)', letterSpacing: '0.02em' }}>
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── daily bar chart ─────────────────────────────────────────────────────── */

function DailyChart({ rows }: { rows: { date: string; cost: number }[] }) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const maxCost = Math.max(...sorted.map((r) => r.cost), 0.000001);
  const H = 80;

  return (
    <div className="term-panel">
      <div className="term-panel-head">daily spend</div>
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', gap: 4, height: H }}>
          {sorted.map((row) => {
            const barH = Math.max(2, Math.round((row.cost / maxCost) * H));
            const isZero = row.cost === 0;
            return (
              <div
                key={row.date}
                title={`${shortDate(row.date)} · ${formatCost(row.cost)}`}
                style={{ flex: 1, maxWidth: 46, height: barH, borderRadius: '3px 3px 0 0',
                  background: isZero ? 'var(--t-border)' : 'var(--t-accent)',
                  opacity: isZero ? 1 : 0.85, transition: 'height 0.3s ease', cursor: 'default' }}
              />
            );
          })}
        </div>

        {/* x-axis labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: 'var(--font-m)' }}>
          <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>{shortDate(sorted[0].date)}</span>
          {sorted.length > 2 && (
            <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>{shortDate(sorted[Math.floor(sorted.length / 2)].date)}</span>
          )}
          <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>{shortDate(sorted[sorted.length - 1].date)}</span>
        </div>
        {/* y hints */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, borderTop: '1px solid var(--t-border)', paddingTop: 8, fontFamily: 'var(--font-m)' }}>
          <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>$0</span>
          <span style={{ fontSize: 10, color: 'var(--t-dim)' }}>peak {formatCost(maxCost)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── by-model table ──────────────────────────────────────────────────────── */

function ModelTable({ rows }: { rows: { modelId: string; displayName: string; cost: number }[] }) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.cost - a.cost);
  const total = sorted.reduce((s, r) => s + r.cost, 0) || 1;

  return (
    <div className="term-panel">
      <div className="term-panel-head">by model</div>
      <table className="term-table">
        <thead>
          <tr>
            <th style={{ width: '38%' }}>model</th>
            <th style={{ width: '18%', textAlign: 'right' }}>cost</th>
            <th>share</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const pct = (row.cost / total) * 100;
            return (
              <tr key={row.modelId}>
                <td style={{ color: 'var(--t-text)' }}>{row.displayName}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-m)' }}>
                  {formatCost(row.cost)}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--t-bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, background: 'var(--t-accent)', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--t-dim)', minWidth: 30, textAlign: 'right', fontFamily: 'var(--font-m)' }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonPanel({ height = 80 }: { height?: number }) {
  return <div className="term-panel" style={{ flex: 1, height, background: 'var(--t-elev)', animation: 'term-dots 1.4s infinite' }} />;
}

/* ─── page ────────────────────────────────────────────────────────────────── */

export default function CostsPage() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getCostSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const isEmpty = !loading && summary !== null && summary.byModel.length === 0 && summary.daily.length === 0;

  return (
    <div className="term-scroll" style={{ position: 'absolute', inset: 0 }}>
      <div className="term-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860, margin: '0 auto' }}>

        {/* action row (location lives in the header) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
          <button className="term-btn ghost" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => void load()} disabled={loading}>
            {loading ? '···' : 'refresh'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', border: '1px solid var(--t-border-2)', borderRadius: 'var(--t-radius-sm)', color: '#f87171', fontSize: 12 }}>
            err: {error}{' '}
            <button onClick={() => void load()} style={{ color: 'var(--t-muted)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-m)', fontSize: 12 }}>retry</button>
          </div>
        )}

        {loading && !summary && (
          <>
            <div style={{ display: 'flex', gap: 14 }}>
              <SkeletonPanel height={88} />
              <SkeletonPanel height={88} />
            </div>
            <SkeletonPanel height={140} />
            <SkeletonPanel height={200} />
          </>
        )}

        {(summary || loading) && (
          <div style={{ display: 'flex', gap: 14 }}>
            <StatPanel label="this month" value={formatCost(summary?.thisMonth ?? 0)} loading={loading} />
            <StatPanel label="all time" value={formatCost(summary?.allTime ?? 0)} loading={loading} />
          </div>
        )}

        {summary && summary.byModel.length > 0 && <ModelTable rows={summary.byModel} />}
        {summary && summary.daily.length > 0 && <DailyChart rows={summary.daily} />}

        {isEmpty && (
          <div className="term-empty" style={{ height: 240 }}>
            <div className="big">user@aero:~/costs$</div>
            <div>no spend data yet - start chatting to see usage<span className="term-caret" /></div>
          </div>
        )}
      </div>
    </div>
  );
}
