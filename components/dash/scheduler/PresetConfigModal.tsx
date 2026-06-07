'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresetDefinition, SchedulerCapabilities } from '@/lib/dash/scheduler';
import type { FromPresetOverrides } from '@/lib/dash/scheduledTasks';

interface PresetConfigModalProps {
  preset: PresetDefinition;
  capabilities: SchedulerCapabilities | null;
  onCreate: (config: Record<string, unknown>, overrides: FromPresetOverrides) => Promise<void>;
  onClose: () => void;
}

export function PresetConfigModal({
  preset,
  capabilities,
  onCreate,
  onClose,
}: PresetConfigModalProps) {
  // Build initial field values from defaults
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of preset.requires_config) {
      init[f.key] = f.default !== undefined ? String(f.default) : '';
    }
    return init;
  });

  // Delivery overrides
  const [deliverChat, setDeliverChat] = useState(preset.deliver_chat);
  const [deliverTelegram, setDeliverTelegram] = useState(preset.deliver_telegram);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => firstRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Escape to close (unless mid-create)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, creating]);

  const handleConfirm = useCallback(async () => {
    setError(null);
    setCreating(true);

    // Coerce typed fields
    const config: Record<string, unknown> = {};
    for (const f of preset.requires_config) {
      const raw = values[f.key] ?? '';
      if (f.type === 'number') {
        const n = parseFloat(raw);
        config[f.key] = isNaN(n) ? 0 : n;
      } else {
        config[f.key] = raw;
      }
    }

    const overrides: FromPresetOverrides = {
      deliver_chat: deliverChat,
      deliver_telegram: deliverTelegram,
    };

    try {
      await onCreate(config, overrides);
      // parent closes the modal on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to create task');
      setCreating(false);
    }
  }, [values, preset.requires_config, deliverChat, deliverTelegram, onCreate]);

  const telegramAvailable = capabilities?.telegram_delivery ?? false;

  return (
    <>
      {/* backdrop */}
      <div
        onClick={() => { if (!creating) onClose(); }}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pcm-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 70,
          width: 420, maxWidth: 'calc(100vw - 32px)',
          background: 'var(--bg)',
          border: '1px solid var(--border-strong)',
          borderRadius: 2,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div className="term-panel-head" style={{ justifyContent: 'space-between' }}>
          <span id="pcm-title">configure / {preset.title}</span>
          <button
            className="term-btn ghost"
            onClick={onClose}
            disabled={creating}
            aria-label="Close"
            style={{ padding: '1px 7px', fontSize: 11 }}
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* description */}
          <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55, margin: 0 }}>
            {preset.description}
          </p>

          {/* required config fields */}
          {preset.requires_config.map((field, idx) => (
            <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label
                htmlFor={`pcm-${field.key}`}
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--text-dim)',
                }}
              >
                {field.label}
              </label>
              <input
                id={`pcm-${field.key}`}
                ref={idx === 0 ? firstRef : undefined}
                type={field.type === 'number' ? 'number' : 'text'}
                className="term-input"
                value={values[field.key] ?? ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                disabled={creating}
                placeholder={
                  field.type === 'city'
                    ? 'e.g. London'
                    : field.default !== undefined
                    ? String(field.default)
                    : ''
                }
              />
              {field.type === 'city' && (
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  city name - coordinates resolved automatically
                </span>
              )}
            </div>
          ))}

          {/* delivery overrides */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)' }}>
              delivery
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={deliverChat}
                onChange={(e) => setDeliverChat(e.target.checked)}
                disabled={creating}
                style={{ accentColor: 'var(--text)', cursor: 'pointer' }}
              />
              deliver to chat
            </label>

            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: telegramAvailable ? 'pointer' : 'not-allowed',
                fontSize: 12,
                color: telegramAvailable ? 'var(--text-muted)' : 'var(--text-dim)',
                opacity: telegramAvailable ? 1 : 0.5,
              }}
              title={!telegramAvailable ? 'telegram not configured on this server' : undefined}
            >
              <input
                type="checkbox"
                checked={deliverTelegram}
                onChange={(e) => setDeliverTelegram(e.target.checked)}
                disabled={creating || !telegramAvailable}
                style={{ accentColor: 'var(--text)', cursor: telegramAvailable ? 'pointer' : 'not-allowed' }}
              />
              deliver to telegram
              {!telegramAvailable && (
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(unavailable)</span>
              )}
            </label>
          </div>

          {/* error */}
          {error && (
            <div
              style={{
                padding: '7px 10px',
                border: '1px solid var(--border-strong)',
                borderRadius: 2,
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              error: {error}
            </div>
          )}
        </div>

        {/* footer */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            className="term-btn ghost"
            onClick={onClose}
            disabled={creating}
          >
            cancel
          </button>
          <button
            className="term-btn"
            onClick={handleConfirm}
            disabled={creating}
          >
            {creating ? 'creating…' : 'activate'}
          </button>
        </div>
      </div>
    </>
  );
}
