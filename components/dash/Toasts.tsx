'use client';

import { useEffect } from 'react';
import { useToastStore } from '@/lib/dash/stores/toastStore';

export default function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.removeToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => remove(t.id), 4000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, remove]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 36,
        right: 16,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => remove(t.id)}
          style={{
            textAlign: 'left',
            padding: '9px 13px',
            borderRadius: 2,
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: t.type === 'error' ? 'var(--text)' : 'var(--text-muted)',
            maxWidth: 320,
          }}
        >
          <span style={{ color: 'var(--text-dim)' }}>
            {t.type === 'error' ? '✗ ' : t.type === 'success' ? '✓ ' : '· '}
          </span>
          {t.message}
        </button>
      ))}
    </div>
  );
}
