'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export interface SelOption {
  id: string;
  label: string;
  sub?: string;   // e.g. provider / model id
  right?: string; // e.g. cost summary
  disabled?: boolean; // greyed + not selectable (e.g. non-vision model while an image is attached)
}

interface Props {
  options: SelOption[];
  value: string | null;
  onSelect: (id: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
  width?: number;
  // When locked, the box still renders but clicking shows a small "PRO only"
  // popover instead of opening the options.
  locked?: boolean;
  lockedMessage?: string;
}

export default function ComposerSelect({ options, value, onSelect, placeholder, icon, width = 200, locked = false, lockedMessage }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const labelText = selected ? selected.label : placeholder;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="term-input"
        style={{
          width: 'auto', minWidth: 0, padding: '6px 10px', fontSize: 12,
          display: 'inline-flex', alignItems: 'center', gap: 7,
          color: selected ? 'var(--t-text)' : 'var(--t-dim)', cursor: 'pointer',
          ...(open ? { borderColor: 'var(--t-accent-dim)' } : {}),
        }}
      >
        {icon && <span style={{ color: 'var(--t-dim)', display: 'flex' }}>{icon}</span>}
        <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelText}</span>
        {locked ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, color: 'var(--t-dim)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginLeft: 2, color: 'var(--t-dim)' }}>
            <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        )}
      </button>

      {/* locked → mini PRO popover */}
      {open && locked && (
        <div
          style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 50, width: 220,
            background: 'var(--t-elev-2)', border: '1px solid var(--t-border-2)',
            borderRadius: 'var(--t-radius)', boxShadow: 'var(--t-shadow-lg)', padding: '12px 13px',
            display: 'flex', flexDirection: 'column', gap: 9,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--t-text)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Only for PRO
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--t-dim)', lineHeight: 1.5 }}>
            {lockedMessage ?? 'Upgrade to PRO to use this.'}
          </div>
          <Link href="/dashboard/billing" className="term-btn primary" style={{ fontSize: 11, padding: '4px 10px', textAlign: 'center' }} onClick={() => setOpen(false)}>
            upgrade to pro
          </Link>
        </div>
      )}

      {open && !locked && (
        <div
          style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 50,
            width, maxHeight: 320, overflowY: 'auto',
            background: 'var(--t-elev-2)', border: '1px solid var(--t-border-2)',
            borderRadius: 'var(--t-radius)', boxShadow: 'var(--t-shadow-lg)', padding: 5,
          }}
        >
          {options.map((o) => {
            const active = o.id === value;
            const disabled = !!o.disabled;
            return (
              <button
                key={o.id || '__none__'}
                type="button"
                disabled={disabled}
                onClick={() => { if (disabled) return; onSelect(o.id); setOpen(false); }}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 2, width: '100%', textAlign: 'left',
                  padding: '7px 10px', borderRadius: 'var(--t-radius-sm)',
                  background: active ? 'var(--t-hover)' : 'transparent',
                  color: active ? 'var(--t-text)' : 'var(--t-muted)',
                  opacity: disabled ? 0.38 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => { if (!active && !disabled) (e.currentTarget.style.background = 'var(--t-hover)'); }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget.style.background = 'transparent'); }}
              >
                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {active && <span style={{ color: 'var(--t-accent)', marginRight: 6 }}>›</span>}{o.label}
                  </span>
                  {o.sub && <span className="mono" style={{ fontSize: 10, color: 'var(--t-dim)', flexShrink: 0 }}>{o.sub}</span>}
                </span>
                {o.right && <span className="mono" style={{ fontSize: 10.5, color: 'var(--t-dim)' }}>{o.right}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
