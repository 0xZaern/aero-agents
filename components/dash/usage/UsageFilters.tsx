'use client';

import type { AgentId, DateWindow } from '@/lib/dash/usageData';
import { AGENT_META } from '@/lib/dash/usageData';

const WINDOWS: { key: DateWindow; label: string }[] = [
  { key: '7d',  label: '7d' },
  { key: '14d', label: '14d' },
  { key: '30d', label: '30d' },
];

const ALL_AGENTS = Object.keys(AGENT_META) as AgentId[];

interface UsageFiltersProps {
  window: DateWindow;
  onWindowChange: (w: DateWindow) => void;
  /** null = all agents; array = specific selection */
  selectedAgents: AgentId[] | null;
  onAgentToggle: (id: AgentId) => void;
  onClearAgents: () => void;
  loading: boolean;
}

export function UsageFilters({
  window,
  onWindowChange,
  selectedAgents,
  onAgentToggle,
  onClearAgents,
  loading,
}: UsageFiltersProps) {
  const allSelected = selectedAgents === null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
      }}
      role="toolbar"
      aria-label="Usage filters"
    >
      {/* Date window selector */}
      <div
        role="group"
        aria-label="Date window"
        style={{
          display: 'flex',
          gap: 0,
          border: '1px solid var(--t-border-2)',
          borderRadius: 'var(--t-radius-sm)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {WINDOWS.map((w) => {
          const active = window === w.key;
          return (
            <button
              key={w.key}
              onClick={() => !loading && onWindowChange(w.key)}
              aria-pressed={active}
              disabled={loading}
              style={{
                padding: '5px 14px',
                borderRadius: 0,
                border: 'none',
                borderRight: w.key !== '30d' ? '1px solid var(--t-border-2)' : 'none',
                background: active ? 'var(--t-accent-soft)' : 'var(--t-elev)',
                color: active ? 'var(--t-accent)' : 'var(--t-muted)',
                fontFamily: 'var(--font-m)',
                fontSize: 11,
                letterSpacing: '0.04em',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {w.label}
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div
        aria-hidden="true"
        style={{ width: 1, height: 22, background: 'var(--t-border-2)', flexShrink: 0 }}
      />

      {/* Agent filter chips */}
      <div
        role="group"
        aria-label="Filter by agent"
        style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}
      >
        {/* "All" clear chip */}
        <button
          onClick={onClearAgents}
          aria-pressed={allSelected}
          disabled={loading}
          style={{
            padding: '4px 11px',
            border: '1px solid',
            borderColor: allSelected ? 'var(--t-accent-dim)' : 'var(--t-border)',
            borderRadius: 'var(--t-radius-sm)',
            background: allSelected ? 'var(--t-accent-soft)' : 'transparent',
            color: allSelected ? 'var(--t-accent)' : 'var(--t-dim)',
            fontFamily: 'var(--font-m)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            transition: 'all 0.15s',
          }}
        >
          all
        </button>

        {ALL_AGENTS.map((id) => {
          const meta = AGENT_META[id];
          const selected = selectedAgents?.includes(id) ?? true;
          return (
            <button
              key={id}
              onClick={() => !loading && onAgentToggle(id)}
              aria-pressed={selected && !allSelected}
              disabled={loading}
              style={{
                padding: '4px 11px',
                border: '1px solid',
                borderColor:
                  !allSelected && selected
                    ? 'var(--t-accent-dim)'
                    : 'var(--t-border)',
                borderRadius: 'var(--t-radius-sm)',
                background:
                  !allSelected && selected
                    ? 'var(--t-accent-soft)'
                    : 'transparent',
                color:
                  !allSelected && selected
                    ? 'var(--t-accent)'
                    : 'var(--t-dim)',
                fontFamily: 'var(--font-m)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {meta.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
