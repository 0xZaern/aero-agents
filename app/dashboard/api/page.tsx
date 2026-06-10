'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listApiKeys, createApiKey, revokeApiKey, getApiConfig, getApiUsage, getApiBalance,
  type ApiKey, type ApiConfig, type VvvPack, type ApiUsageRow,
} from '@/lib/dash/api';
import { sendVvvPayment, type PayStep } from '@/lib/dash/vvvPayment';

function Panel({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="term-panel">
      <div className="term-panel-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label}</span>{right}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

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
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function stepLabel(s: PayStep): string {
  switch (s) {
    case 'confirming': return 'confirm in your wallet…';
    case 'pending': return 'waiting for confirmation…';
    case 'verifying': return 'verifying payment…';
    case 'success': return '✓ payment complete';
    default: return '';
  }
}

// /v1 is proxied through this site (see next.config.ts rewrites), so the public
// API base is the site's own origin - the real domain in production, localhost
// in dev. Falls back to NEXT_PUBLIC_API_URL for SSR / unusual setups.
const API_BASE =
  (typeof window !== 'undefined' ? window.location.origin : '') ||
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')) ||
  'https://your-domain.com';

// The public endpoint catalog. Adding an agent later = one more entry here;
// the grid wraps, so the layout scales no matter how many agents ship.
type Endpoint = { method: 'GET' | 'POST'; path: string; desc: string; billing: string; model: boolean };
const ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/v1/chat', desc: 'Chat completion across any model', billing: 'per-token', model: true },
  { method: 'POST', path: '/v1/agent', desc: 'Run a preset tool-using agent', billing: 'per-token', model: true },
  { method: 'POST', path: '/v1/youtube', desc: 'Transcribe and summarize a video', billing: 'per-token', model: true },
  { method: 'POST', path: '/v1/github', desc: 'Developer audit of a public repo', billing: 'per-token', model: true },
  { method: 'POST', path: '/v1/docs', desc: 'Audit documentation for gaps and clarity', billing: 'per-token', model: true },
  { method: 'POST', path: '/v1/legitimacy', desc: 'Legitimacy audit of a project URL', billing: 'per-token', model: true },
  { method: 'POST', path: '/v1/slop', desc: 'AI-slop scan of text or code', billing: 'flat fee', model: false },
  { method: 'GET', path: '/v1/models', desc: 'List callable models and pricing', billing: 'free', model: false },
];

export default function DeveloperApiPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [usage, setUsage] = useState<ApiUsageRow[]>([]);
  const [apiCredits, setApiCredits] = useState<number>(0);

  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);  // raw key shown once
  const [copied, setCopied] = useState(false);

  const [step, setStep] = useState<PayStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busyPack, setBusyPack] = useState<string | null>(null);

  const busy = step === 'confirming' || step === 'pending' || step === 'verifying';

  const reloadKeys = useCallback(() => { listApiKeys().then(setKeys).catch(() => {}); }, []);
  const reloadUsage = useCallback(() => { getApiUsage().then(setUsage).catch(() => {}); }, []);
  const reloadBalance = useCallback(() => { getApiBalance().then((b) => setApiCredits(b.apiCredits)).catch(() => {}); }, []);

  useEffect(() => {
    reloadKeys();
    reloadUsage();
    reloadBalance();
    getApiConfig().then(setConfig).catch(() => {});
  }, [reloadKeys, reloadUsage, reloadBalance]);

  async function mint() {
    if (creating) return;
    setCreating(true); setError(null);
    try {
      const res = await createApiKey(label.trim());  // blank → backend auto-names "API key N"
      setFreshKey(res.key);
      setLabel('');
      reloadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not create key');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    try { await revokeApiKey(id); reloadKeys(); } catch { /* ignore */ }
  }

  async function copyKey() {
    if (!freshKey) return;
    try { await navigator.clipboard.writeText(freshKey); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  async function buy(pack: VvvPack) {
    if (busy) return;
    setError(null); setBusyPack(pack.id);
    try {
      const res = await sendVvvPayment(pack.id, pack.vvv, setStep);
      setApiCredits(res.credits);   // VVV tops up the API wallet, not web credits
      reloadUsage();
      setTimeout(() => { setStep('idle'); setBusyPack(null); }, 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'payment failed');
      setBusyPack(null);
    }
  }

  const packs = config?.packs ?? [];
  const curl = `curl ${API_BASE}/v1/chat \\
  -H "Authorization: Bearer sk_aero_..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Hello"}]}'`;

  return (
    <div className="term-scroll" style={{ position: 'absolute', inset: 0 }}>
      <div className="term-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760, margin: '0 auto' }}>

        {/* banners */}
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

        {/* stat row: credits full-width on top, then active keys + endpoints side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <StatCard label="api credits" value={`$${apiCredits.toFixed(2)}`} sub="separate wallet, VVV top-up" accent />
          </div>
          <StatCard label="active keys" value={String(keys.length)} sub="share one balance" />
          <StatCard label="endpoints" value={String(config?.endpoints ?? ENDPOINTS.length)} sub="live on /v1" />
        </div>

        {/* freshly-minted key (shown once) */}
        {freshKey && (
          <div className="term-panel" style={{ border: '1px solid var(--t-accent-dim)' }}>
            <div className="term-panel-head">your new key, copy it now (it won&apos;t be shown again)</div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <code style={{ fontFamily: 'var(--font-m)', fontSize: 12.5, wordBreak: 'break-all', color: 'var(--t-accent)', background: 'var(--t-bg-2)', padding: '10px 12px', borderRadius: 'var(--t-radius-sm)' }}>{freshKey}</code>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="term-btn primary" onClick={copyKey}>{copied ? '✓ copied' : 'copy key'}</button>
                <button className="term-btn ghost" onClick={() => setFreshKey(null)}>done</button>
              </div>
            </div>
          </div>
        )}

        {/* stacked panels, full width */}
        <Panel label="api keys">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="term-input"
                    value={label}
                    placeholder="key name (optional, e.g. my telegram bot)"
                    maxLength={60}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') mint(); }}
                    style={{ flex: 1, minWidth: 160, fontSize: 12 }}
                  />
                  <button className="term-btn primary" disabled={creating} onClick={mint}>
                    {creating ? '···' : '+ create key'}
                  </button>
                </div>

                {keys.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--t-dim)' }}>no keys yet, create one to call the API</div>
                ) : (
                  <div className="term-table-wrap">
                  <table className="term-table">
                    <thead>
                      <tr>
                        <th>name</th><th className="col-key">key</th><th className="hide-sm">last used</th><th className="col-x"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k) => (
                        <tr key={k.id}>
                          <td>{k.label}</td>
                          <td className="col-key" style={{ fontFamily: 'var(--font-m)', fontSize: 11 }}>{k.prefix}…</td>
                          <td className="hide-sm" style={{ fontSize: 11, color: 'var(--t-dim)' }}>{k.lastUsedAt ? fmtTime(k.lastUsedAt) : 'never'}</td>
                          <td className="col-x" style={{ textAlign: 'right' }}>
                            <button className="term-btn ghost revoke-btn" style={{ fontSize: 16, lineHeight: 1, padding: '2px 7px' }} title="revoke key" aria-label="revoke key" onClick={() => revoke(k.id)}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </Panel>

            <Panel label="top up api wallet">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {packs.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--t-dim)' }}>top-up options unavailable, check back shortly</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                    {packs.map((p) => (
                      <div key={p.id} className="term-panel" style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-m)', fontSize: 22, color: 'var(--t-accent)' }}>+${p.credits.toFixed(0)}</span>
                        <span style={{ fontSize: 11, color: 'var(--t-dim)' }}>added to wallet</span>
                        <button
                          className="term-btn primary"
                          style={{ marginTop: 6, fontSize: 12 }}
                          disabled={busy}
                          onClick={() => buy(p)}
                        >
                          {busyPack === p.id && busy ? '···' : `pay ${p.vvv} VVV`}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <span style={{ fontSize: 11, color: 'var(--t-dim)', lineHeight: 1.5 }}>
                  Pay in VVV (Venice Token) on Base, sent from your wallet to the treasury. The
                  {' '}<strong>+$</strong> is the USD credit that lands in your wallet; bigger top-ups
                  give more credit per VVV. Credits never expire and drain per API call by the
                  model&apos;s token cost. Run out, calls pause, top up again with the same key.
                </span>
              </div>
            </Panel>

        <Panel label="endpoints">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {ENDPOINTS.map((e) => (
                  <div key={e.path} className="term-panel" style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: e.method === 'GET' ? 'var(--t-dim)' : 'var(--t-accent)', border: '1px solid var(--t-border-2)', borderRadius: 4, padding: '1px 6px' }}>{e.method}</span>
                      <code style={{ fontFamily: 'var(--font-m)', fontSize: 12, color: 'var(--t-text)' }}>{e.path}</code>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--t-muted)', lineHeight: 1.4 }}>{e.desc}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      <span style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--t-dim)', border: '1px solid var(--t-border-2)', borderRadius: 'var(--t-radius-sm)', padding: '2px 7px' }}>{e.billing}</span>
                      {e.model && <span style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--t-accent)', border: '1px solid var(--t-accent-dim)', borderRadius: 'var(--t-radius-sm)', padding: '2px 7px' }}>pick model</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel label="quickstart">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--t-muted)' }}>Call the API with any HTTP client. Pass your key as a Bearer token.</span>
                <pre style={{ fontFamily: 'var(--font-m)', fontSize: 11.5, lineHeight: 1.6, background: 'var(--t-bg-2)', padding: '12px 14px', borderRadius: 'var(--t-radius-sm)', overflowX: 'auto', margin: 0, color: 'var(--t-text)' }}>{curl}</pre>
                <span style={{ fontSize: 11, color: 'var(--t-dim)', lineHeight: 1.5 }}>
                  Every endpoint shares one balance. Pick the LLM per call with the <code>model</code> field
                  (any id from /v1/models); omit it to use the default.
                </span>
              </div>
            </Panel>

        {/* usage, full width */}
        <Panel label="recent usage" right={<button className="term-btn ghost" style={{ fontSize: 11, padding: '2px 9px' }} onClick={reloadUsage}>refresh</button>}>
          {usage.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--t-dim)' }}>no API calls yet</div>
          ) : (
            <div className="term-table-wrap">
            <table className="term-table">
              <thead>
                <tr>
                  <th>time</th><th>endpoint</th><th className="hide-sm">model</th>
                  <th style={{ textAlign: 'right' }}>tokens</th>
                  <th style={{ textAlign: 'right' }}>cost</th>
                  <th className="hide-sm" style={{ textAlign: 'right' }}>status</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontSize: 11, color: 'var(--t-dim)' }}>{fmtTime(u.createdAt)}</td>
                    <td style={{ fontFamily: 'var(--font-m)', fontSize: 11 }}>{u.endpoint}</td>
                    <td className="hide-sm" style={{ fontSize: 11 }}>{u.modelId || '-'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-m)', fontSize: 11 }}>{u.inputTokens + u.outputTokens || '-'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-m)', fontSize: 11 }}>{u.creditsSpent > 0 ? `$${u.creditsSpent.toFixed(4)}` : '-'}</td>
                    <td className="hide-sm" style={{ textAlign: 'right' }}>
                      <span className={`pill ${u.statusCode === 200 ? 'active' : 'paused'}`} style={{ fontSize: 9 }}>{u.statusCode}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Panel>

      </div>
    </div>
  );
}
