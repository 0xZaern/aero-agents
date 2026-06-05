'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectWallet } from '@/lib/dash/api';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import { useAuthModal } from '@/lib/dash/stores/authModalStore';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
function getEth(): Eth | undefined {
  return typeof window !== 'undefined' ? (window as unknown as { ethereum?: Eth }).ethereum : undefined;
}

interface Method {
  id: string;
  name: string;
  detail: string;
  icon: React.ReactNode;
}

const METHODS: Method[] = [
  {
    id: 'wallet',
    name: 'Browser Wallet',
    detail: 'MetaMask, Rabby, or any injected wallet',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M16 14h2" />
      </svg>
    ),
  },
];

export default function ConnectModal() {
  const router = useRouter();
  const open = useAuthModal((s) => s.open);
  const setOpen = useAuthModal((s) => s.setOpen);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => { if (!busy) { setOpen(false); setError(null); } }, [busy, setOpen]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, close]);

  // The modal is mounted persistently, so reset transient state every time it
  // (re)opens. Otherwise a leftover `busy` from a prior successful connect
  // disables the close button and leaves the wallet row stuck on "…".
  useEffect(() => {
    if (open) { setBusy(null); setError(null); }
  }, [open]);

  const authWith = useCallback(async (address: string) => {
    const res = await connectWallet(address);
    setAuth(res.token, {
      id: res.user.id,
      walletAddress: res.user.walletAddress,
      credits: res.user.credits,
      plan: res.user.plan,
      pro_expires_at: res.user.proExpiresAt ?? null,
      themeOverrides: res.user.themeOverrides ?? null,
    });
    setBusy(null);
    setOpen(false);
    router.push('/dashboard/chat');
  }, [setAuth, setOpen, router]);

  const pick = useCallback(async () => {
    setError(null);
    const eth = getEth();
    if (!eth) { setError('No wallet detected - install MetaMask or Rabby to continue.'); return; }
    setBusy('wallet');
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      if (!accounts?.[0]) throw new Error('No account returned');
      await authWith(accounts[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet connect failed');
      setBusy(null);
    }
  }, [authWith]);

  if (!open) return null;

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'grid', placeItems: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        animation: 'aeroFade 0.18s ease-out',
        padding: 16,
      }}
    >
      <style>{`
        @keyframes aeroFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes aeroRise { from { opacity: 0; transform: translateY(10px) scale(0.98) } to { opacity: 1; transform: none } }
        .aero-connect-opt:hover { border-color: var(--border-strong); background: var(--surface-hover); }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420, maxWidth: '94vw',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          animation: 'aeroRise 0.22s cubic-bezier(0.2,0.8,0.2,1)',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.02em' }}>Connect to aero</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Connect your wallet to continue. New wallets get $1.00 free credits.
            </div>
          </div>
          <button
            onClick={close}
            aria-label="close"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* options */}
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {METHODS.map((m) => {
            const loading = busy === m.id;
            return (
              <button
                key={m.id}
                className="aero-connect-opt"
                disabled={!!busy}
                onClick={() => pick()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  width: '100%', textAlign: 'left',
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--text)', cursor: busy ? 'default' : 'pointer',
                  opacity: busy && !loading ? 0.5 : 1,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                <span style={{ color: 'var(--text)', display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {m.icon}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{m.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{m.detail}</span>
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{loading ? '…' : '→'}</span>
              </button>
            );
          })}

          {error && (
            <div style={{ fontSize: 12.5, color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 12px', marginTop: 2 }}>
              <span style={{ color: 'var(--text-dim)' }}>! </span>{error}
            </div>
          )}
        </div>

        <div style={{ padding: '0 20px 16px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
          By connecting you agree to the terms &amp; privacy policy.
        </div>
      </div>
    </div>
  );
}
