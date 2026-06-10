'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/dash/stores/authStore';
import { getPaymentConfig, getPaymentHistory } from '@/lib/dash/api';
import type { Payment, PaymentConfig } from '@/lib/dash/api';
import { sendUsdcPayment, type PayStep } from '@/lib/dash/payment';

const PRESET_AMOUNTS = [5, 10, 25, 50, 100] as const;
const PRO_PERKS = [
  '50% off all model usage',
  'unlock agents, teams & the scheduler',
  '$20 in credits included',
];

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="term-panel">
      <div className="term-panel-head">{label}</div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

// Compact stat tile (plan / balance) — no pills, matches the analyzer aesthetic.
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="term-panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t-dim)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-m)', fontSize: 22, lineHeight: 1.1, color: accent ? 'var(--t-accent)' : 'var(--t-text)' }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--t-dim)' }}>{sub}</span>}
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function shortHash(h: string): string { return h ? `${h.slice(0, 6)}…${h.slice(-4)}` : 'N/A'; }

function stepLabel(s: PayStep): string {
  switch (s) {
    case 'confirming': return 'confirm in your wallet…';
    case 'pending': return 'waiting for confirmation…';
    case 'verifying': return 'verifying payment…';
    case 'success': return '✓ payment complete';
    default: return '';
  }
}

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isPro = user?.plan === 'pro';

  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amount, setAmount] = useState<number>(10);
  const [custom, setCustom] = useState<string>('');

  const [step, setStep] = useState<PayStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<'pro' | 'credits' | null>(null);

  const proPrice = config?.proPrice ?? 80;

  const loadHistory = useCallback(() => {
    getPaymentHistory().then(setPayments).catch(() => {});
  }, []);

  useEffect(() => {
    getPaymentConfig().then(setConfig).catch(() => {});
    loadHistory();
  }, [loadHistory]);

  const busy = step === 'confirming' || step === 'pending' || step === 'verifying';

  async function pay(value: number, kind: 'pro' | 'credits') {
    if (busy) return;
    setError(null);
    setBusyKind(kind);
    try {
      const res = await sendUsdcPayment(value, kind, setStep);
      updateUser({ credits: res.credits, plan: res.plan, pro_expires_at: res.proExpiresAt });
      loadHistory();
      setTimeout(() => { setStep('idle'); setBusyKind(null); }, 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'payment failed');
      setBusyKind(null);
    }
  }

  const creditAmount = custom ? Math.max(1, Math.floor(Number(custom) || 0)) : amount;

  return (
    <div className="term-scroll" style={{ position: 'absolute', inset: 0 }}>
      <div className="term-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720, margin: '0 auto' }}>

        {/* status banner */}
        {(busy || step === 'success') && (
          <div style={{ padding: '9px 14px', border: '1px solid var(--t-accent-dim)', borderRadius: 'var(--t-radius-sm)', background: 'var(--t-accent-soft)', color: 'var(--t-text)', fontFamily: 'var(--font-m)', fontSize: 12 }}>
            {stepLabel(step)}{busy && <span className="term-caret" />}
          </div>
        )}
        {error && (
          <div style={{ padding: '9px 14px', border: '1px solid var(--t-border-2)', borderRadius: 'var(--t-radius-sm)', color: '#f87171', fontSize: 12 }}>
            ! {error}
          </div>
        )}

        {/* account status — two stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <StatCard
            label="plan"
            value={isPro ? 'pro' : 'basic'}
            sub={isPro ? (user?.pro_expires_at ? `renews ${fmtDate(user.pro_expires_at)}` : 'active') : 'free tier'}
            accent={isPro}
          />
          <StatCard label="credits" value={`$${(user?.credits ?? 0).toFixed(2)}`} sub="USDC balance" accent />
        </div>

        {/* pro */}
        <Panel label={isPro ? 'renew pro' : 'upgrade to pro'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-m)', fontSize: 26, color: 'var(--t-text)' }}>${proPrice}</span>
                <span style={{ fontSize: 12, color: 'var(--t-dim)' }}>USDC / month · on-chain (Base)</span>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 5, listStyle: 'none', margin: 0, padding: 0 }}>
                {PRO_PERKS.map((perk) => (
                  <li key={perk} style={{ fontSize: 12.5, color: 'var(--t-muted)' }}>
                    <span style={{ color: 'var(--t-accent)', marginRight: 8 }}>›</span>{perk}
                  </li>
                ))}
              </ul>
              <button
                className="term-btn primary"
                style={{ alignSelf: 'flex-start' }}
                disabled={busy}
                onClick={() => pay(proPrice, 'pro')}
              >
                {busyKind === 'pro' && busy ? '···' : `pay $${proPrice} USDC`}
              </button>
            </div>
          </Panel>

          {/* buy credits */}
          <Panel label="buy credits">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    className={!custom && amount === amt ? 'term-btn' : 'term-btn ghost'}
                    style={{ fontSize: 12, padding: '6px 14px' }}
                    onClick={() => { setAmount(amt); setCustom(''); }}
                  >
                    ${amt}
                  </button>
                ))}
                <input
                  className="term-input"
                  value={custom}
                  inputMode="numeric"
                  placeholder="custom $"
                  onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ width: 110, fontSize: 12, padding: '6px 11px' }}
                />
                <button
                  className="term-btn primary"
                  style={{ marginLeft: 'auto' }}
                  disabled={busy || creditAmount < 1}
                  onClick={() => pay(creditAmount, 'credits')}
                >
                  {busyKind === 'credits' && busy ? '···' : `add $${creditAmount} in credits`}
                </button>
              </div>
              <span style={{ fontSize: 11, color: 'var(--t-dim)', lineHeight: 1.5 }}>
                USDC on Base, sent directly from your wallet. No gas token needed beyond a little ETH for the transfer.
              </span>
            </div>
          </Panel>

        {/* history */}
        <Panel label="payment history">
          {payments.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--t-dim)' }}>no payments yet</div>
          ) : (
            <table className="term-table">
              <thead>
                <tr>
                  <th>date</th><th>type</th>
                  <th style={{ textAlign: 'right' }}>amount</th>
                  <th style={{ textAlign: 'right' }}>credits</th>
                  <th style={{ textAlign: 'right' }}>tx</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.createdAt)}</td>
                    <td><span className={`pill ${p.paymentType === 'pro' ? 'active' : 'paused'}`}>{p.paymentType}</span></td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-m)' }}>${p.amountUsdc.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-m)' }}>{p.creditsAdded > 0 ? `+$${p.creditsAdded.toFixed(2)}` : '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <a href={`https://basescan.org/tx/${p.txHash}`} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--t-accent)', fontSize: 10, fontFamily: 'var(--font-m)' }}>
                        {shortHash(p.txHash)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
