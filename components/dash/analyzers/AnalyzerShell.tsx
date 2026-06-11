'use client';

import { useEffect, useRef, useCallback } from 'react';

// ─── Full-width segmented score bar (terminal block style) ───────────────────
// Stretches to fill the remaining row width inside a flex container.
export function AsciiBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span
      style={{
        flex: 1,
        minWidth: 80,
        height: 12,
        border: '1px solid var(--t-border-2)',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'inline-block',
      }}
    >
      <span
        style={{
          display: 'block',
          width: `${pct}%`,
          height: '100%',
          background: 'repeating-linear-gradient(90deg, var(--t-muted) 0 8px, transparent 8px 11px)',
          transition: 'width 1.2s ease',
        }}
      />
    </span>
  );
}

// ─── Phase label normalizer ───────────────────────────────────────────────────
const PHASE_LABELS: Record<string, string> = {
  queued:       'queued',
  collecting:   'collecting data',
  verifying:    'verifying signals',
  scoring:      'computing score',
  generating:   'generating report',
  analyzing:    'analyzing',
  reading_code: 'reading code',
  fetching:     'fetching transcript',
  crawling:     'crawling docs',
  running:      'analyzing',
  completed:    'done',
  done:         'done',
  failed:       'failed',
};
export function phaseLabel(status: string): string {
  return PHASE_LABELS[status] ?? status.replace(/_/g, ' ');
}

// ─── Poll hook - calls fetchFn every intervalMs until shouldStop returns true ─
export function usePoller(
  fetchFn: () => Promise<void>,
  shouldStop: () => boolean,
  intervalMs = 2000
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(async () => {
      if (shouldStop()) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      await fetchFn().catch(() => {});
    }, intervalMs);
  }, [fetchFn, shouldStop, intervalMs]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // auto-cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  return { start, stop };
}

// ─── Allowed model list (mirrors backend ALLOWED_MODELS in all three routers) ─
export const ALLOWED_MODELS = [
  { id: 'claude-sonnet-4-6',  label: 'claude-sonnet-4-6' },
  { id: 'claude-opus-4-8',    label: 'claude-opus-4-8' },
  { id: 'deepseek-v4-flash',  label: 'deepseek-v4-flash' },
  { id: 'grok-4-20',          label: 'grok-4-20' },
  { id: 'kimi-k2-6',          label: 'kimi-k2-6' },
  { id: 'minimax-m3',         label: 'minimax-m3' },
  { id: 'llama-3.3-70b',      label: 'llama-3.3-70b' },
] as const;
