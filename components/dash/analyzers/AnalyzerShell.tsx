'use client';

import { useEffect, useRef, useCallback } from 'react';

// ─── Monochrome ASCII progress bar (8 filled blocks out of 12 total) ─────────
export function AsciiBar({ value, max = 100 }: { value: number; max?: number }) {
  const TOTAL = 14;
  const filled = Math.round((value / max) * TOTAL);
  return (
    <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
      {'█'.repeat(filled)}{'░'.repeat(TOTAL - filled)}
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
  { id: 'claude-opus-4-6',    label: 'claude-opus-4-6' },
  { id: 'deepseek-v3.2',      label: 'deepseek-v3.2' },
  { id: 'grok-41-fast',       label: 'grok-41-fast' },
  { id: 'kimi-k2-5',          label: 'kimi-k2-5' },
  { id: 'minimax-m27',        label: 'minimax-m27' },
  { id: 'llama-3.3-70b',      label: 'llama-3.3-70b' },
] as const;
