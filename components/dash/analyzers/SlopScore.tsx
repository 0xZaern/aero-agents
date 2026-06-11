'use client';

import { AsciiBar } from './AnalyzerShell';

// Shared "slop score" widget used by the docs + github analyzers so the
// 0-100 AI-slop rating looks identical everywhere.
// 0-30 human-written (green) · 31-60 mixed (amber) · 61-100 ai slop (red).

export function slopVerdict(score: number): { label: string; pill: string } {
  if (score <= 30) return { label: 'human-written', pill: 'success' };
  if (score <= 60) return { label: 'mixed', pill: 'paused' };
  return { label: 'ai slop', pill: 'failed' };
}

export default function SlopScore({
  score,
  label,
  reasons,
  showVerdict = true,
}: {
  score: number;
  label?: string;       // optional row label (e.g. "readme slop")
  reasons?: string[];   // optional bullet explanations
  showVerdict?: boolean;
}) {
  const verdict = slopVerdict(score);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
        <span style={{ fontFamily: 'var(--font-m)', color: 'var(--t-dim)', minWidth: label ? 110 : 60 }}>{label ?? '0-100'}</span>
        <AsciiBar value={score} />
        <span style={{ fontFamily: 'var(--font-m)', color: 'var(--t-text)', minWidth: 30, textAlign: 'right' }}>{score}</span>
        {showVerdict && <span className={`pill ${verdict.pill}`}>{verdict.label}</span>}
      </div>
      {reasons && reasons.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--font-m)', color: 'var(--t-dim)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            why this score
          </div>
          {reasons.map((r, i) => (
            <div key={i} style={{ fontFamily: 'var(--font-s)', fontSize: 12, color: 'var(--t-muted)', paddingLeft: 10, lineHeight: 1.6 }}>· {r}</div>
          ))}
        </div>
      )}
    </div>
  );
}
