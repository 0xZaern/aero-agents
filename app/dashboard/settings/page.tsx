'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import {
  getTelegramStatus,
  verifyTelegramCode,
  unlinkTelegram,
  getModels,
} from '@/lib/dash/api';
import type { Model } from '@/lib/dash/types';
import { useTheme } from '@/lib/theme';
import {
  CUSTOM_VARS, PRESETS, applyPreset, activePresetId, setVar, resetAll, hasOverrides,
  getDefaultModel, setDefaultModel,
} from '@/lib/dash/customize';

/* ─── types ────────────────────────────────────────────────────────────────── */

type TelegramState =
  | { kind: 'loading' }
  | { kind: 'linked'; telegramId: number }
  | { kind: 'unlinked' }
  | { kind: 'error'; message: string };

/* ─── helpers ──────────────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function shortHash(hash: string): string {
  if (!hash) return 'N/A';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/* ─── layout primitives ────────────────────────────────────────────────────── */

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="term-panel">
      <div className="term-panel-head">{label}</div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--t-border)' }}>
      <span style={{ fontSize: 11, color: 'var(--t-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-m)' }}>{value}</span>
    </div>
  );
}

/* ─── account panel ────────────────────────────────────────────────────────── */

function AccountPanel() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const isPro = user.plan === 'pro';

  return (
    <Panel label="account">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Row label="wallet" value={<span title={user.walletAddress}>{shortAddr(user.walletAddress)}</span>} />
        <Row
          label="plan"
          value={
            <span style={{ fontFamily: 'var(--font-m)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: isPro ? 'var(--t-accent)' : 'var(--t-text)' }}>
              {user.plan}
            </span>
          }
        />
        <Row label="credits" value={`$${user.credits.toFixed(2)}`} />
        {isPro && user.pro_expires_at && (
          <Row label="pro expires" value={fmtDate(user.pro_expires_at)} />
        )}
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/dashboard/billing" className="term-btn ghost" style={{ fontSize: 11, padding: '6px 12px' }}>
          {isPro ? 'manage plan & billing →' : 'upgrade & buy credits →'}
        </Link>
      </div>
    </Panel>
  );
}

/* ─── telegram panel ───────────────────────────────────────────────────────── */

const CODE_LENGTH = 6;

function TelegramPanel() {
  const [state, setState] = useState<TelegramState>({ kind: 'loading' });
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    getTelegramStatus()
      .then((data) => {
        if (data.linked && data.telegram_id !== null) {
          setState({ kind: 'linked', telegramId: data.telegram_id });
        } else {
          setState({ kind: 'unlinked' });
        }
      })
      .catch((err: unknown) => {
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'failed to load' });
      });
  }, []);

  function handleDigit(i: number, raw: string) {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const next = Array(CODE_LENGTH).fill('');
      for (let j = 0; j < CODE_LENGTH; j++) next[j] = cleaned[j] ?? '';
      setDigits(next);
      setCodeError(null);
      inputRefs.current[Math.min(cleaned.length, CODE_LENGTH - 1)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = cleaned.slice(-1);
    setDigits(next);
    setCodeError(null);
    if (cleaned && i < CODE_LENGTH - 1) inputRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    setCodeError(null);
    inputRefs.current[Math.min(text.length, CODE_LENGTH - 1)]?.focus();
  }

  async function handleLink() {
    const code = digits.join('');
    if (code.length < CODE_LENGTH) { setCodeError('enter all 6 digits'); return; }
    setSubmitting(true);
    setCodeError(null);
    try {
      const data = await verifyTelegramCode(code);
      if (data.success) {
        setState({ kind: 'linked', telegramId: data.telegram_id });
        setDigits(Array(CODE_LENGTH).fill(''));
      } else {
        setCodeError('invalid or expired code');
      }
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'link failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await unlinkTelegram();
      setState({ kind: 'unlinked' });
      setConfirmUnlink(false);
    } catch {
      // request() shows toast
    } finally {
      setUnlinking(false);
    }
  }

  const codeComplete = digits.every((d) => d !== '');

  /* loading */
  if (state.kind === 'loading') {
    return (
      <Panel label="telegram">
        <span style={{ color: 'var(--t-dim)', fontSize: 12 }}>loading<span className="term-caret" /></span>
      </Panel>
    );
  }

  /* error */
  if (state.kind === 'error') {
    return (
      <Panel label="telegram">
        <span style={{ color: 'var(--t-muted)', fontSize: 12 }}>err: {state.message}</span>
      </Panel>
    );
  }

  /* linked */
  if (state.kind === 'linked') {
    return (
      <Panel label="telegram">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pill active">linked</span>
            <span style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-m)' }}>
              id {state.telegramId}
            </span>
          </div>
          {confirmUnlink ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--t-dim)' }}>confirm?</span>
              <button
                className="term-btn ghost"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => void handleUnlink()}
                disabled={unlinking}
              >
                {unlinking ? '···' : 'yes, unlink'}
              </button>
              <button
                className="term-btn ghost"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setConfirmUnlink(false)}
                disabled={unlinking}
              >
                cancel
              </button>
            </div>
          ) : (
            <button
              className="term-btn ghost"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setConfirmUnlink(true)}
            >
              unlink
            </button>
          )}
        </div>
      </Panel>
    );
  }

  /* unlinked */
  return (
    <Panel label="telegram">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* instructions */}
        <div style={{ fontSize: 12, color: 'var(--t-muted)', lineHeight: 1.7 }}>
          <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--t-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            how to connect
          </div>
          <div>1. open your aero bot in telegram</div>
          <div>2. send <code style={{ background: 'var(--t-elev)', padding: '1px 5px', border: '1px solid var(--t-border)', borderRadius: 2, fontSize: 11 }}>/link</code></div>
          <div>3. enter the 6-digit code below</div>
        </div>

        {/* digit inputs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              aria-label={`code digit ${i + 1}`}
              style={{
                width: 38,
                height: 44,
                textAlign: 'center',
                fontSize: 16,
                fontFamily: 'var(--font-m)',
                background: 'var(--t-elev)',
                border: `1px solid ${codeError ? '#f87171' : d ? 'var(--t-accent)' : 'var(--t-border-2)'}`,
                borderRadius: 'var(--t-radius-sm)',
                color: 'var(--t-text)',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
            />
          ))}
        </div>

        {codeError && (
          <span style={{ fontSize: 11, color: 'var(--t-muted)' }}>! {codeError}</span>
        )}

        <button
          className="term-btn"
          onClick={() => void handleLink()}
          disabled={!codeComplete || submitting}
          style={{ alignSelf: 'flex-start', fontSize: 12 }}
        >
          {submitting ? '···' : 'link account'}
        </button>
      </div>
    </Panel>
  );
}

/* ─── default model panel ──────────────────────────────────────────────────── */

function DefaultModelPanel() {
  const [models, setModels] = useState<Model[]>([]);
  const [value, setValue] = useState<string>('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getModels().then((m) => {
      setModels(m);
      setValue(getDefaultModel() ?? m[0]?.id ?? '');
    }).catch(() => {});
  }, []);

  function onPick(id: string) {
    setValue(id);
    setDefaultModel(id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <Panel label="default model">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--t-muted)' }}>used for new sessions</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saved && <span className="mono" style={{ fontSize: 11, color: 'var(--t-accent)' }}>✓ saved</span>}
          <select
            value={value}
            onChange={(e) => onPick(e.target.value)}
            style={{ width: 'auto', padding: '7px 11px', fontSize: 12 }}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName} · {m.provider}</option>
            ))}
          </select>
        </div>
      </div>
    </Panel>
  );
}

/* ─── appearance panel ─────────────────────────────────────────────────────── */

function readVar(name: string): string {
  const el = document.querySelector('.term');
  if (!el) return '#000000';
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return /^#([0-9a-f]{6})$/i.test(v) ? v : '#000000';
}

function AppearancePanel() {
  const { theme } = useTheme();
  const [preset, setPreset] = useState<string | null>(null);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [over, setOver] = useState(false);

  const refresh = useCallback(() => {
    const c: Record<string, string> = {};
    for (const v of CUSTOM_VARS) c[v.name] = readVar(v.name);
    setColors(c);
    setPreset(activePresetId());
    setOver(hasOverrides());
  }, []);

  // read after mount (and shortly after, once theme vars settle)
  useEffect(() => { refresh(); const t = setTimeout(refresh, 60); return () => clearTimeout(t); }, [refresh, theme]);

  return (
    <Panel label="appearance">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* accent presets */}
        <Setting label="accent">
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => { applyPreset(p); refresh(); }}
                title={p.label}
                style={{
                  width: 26, height: 26, borderRadius: 'var(--t-radius-sm)',
                  background: p.accent, cursor: 'pointer',
                  border: preset === p.id ? '2px solid var(--t-text)' : '1px solid var(--t-border-2)',
                  boxShadow: preset === p.id ? '0 0 0 3px var(--t-accent-soft)' : 'none',
                }}
              />
            ))}
          </div>
        </Setting>

        {/* color customizer */}
        <Setting label="custom colors">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {CUSTOM_VARS.map((v) => (
              <label key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--t-muted)', fontFamily: 'var(--font-m)' }}>
                <input
                  type="color"
                  value={colors[v.name] ?? '#000000'}
                  onChange={(e) => { setVar(v.name, e.target.value); refresh(); }}
                  style={{ width: 26, height: 26, padding: 0, border: '1px solid var(--t-border-2)', borderRadius: 6, background: 'none', cursor: 'pointer' }}
                />
                {v.label}
              </label>
            ))}
          </div>
        </Setting>

        {/* reset */}
        {over && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="term-btn ghost" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => { resetAll(); refresh(); }}>
              reset to defaults
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--t-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  );
}

/* ─── page ─────────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  return (
    <div className="term-scroll" style={{ position: 'absolute', inset: 0 }}>
      <div className="term-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760, margin: '0 auto' }}>
        <AccountPanel />
        <DefaultModelPanel />
        <AppearancePanel />
        <TelegramPanel />
      </div>
    </div>
  );
}
