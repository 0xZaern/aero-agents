'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AnalyzerPage, { type AnalyzerCtx, type HydrationMapper } from '@/components/dash/analyzers/AnalyzerPage';
import { AsciiBar } from '@/components/dash/analyzers/AnalyzerShell';
import Markdown from '@/components/dash/Markdown';
import {
  walletAnalyze,
  walletGetJob,
  type WalletChain,
} from '@/lib/dash/analyzersApi';

const HINTS = [
  'checking address reputation',
  'scanning token approvals',
  'inspecting contract security',
  'computing risk score',
  'writing the report',
];

// ─── Ethereum address regex ───────────────────────────────────────────────────
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// ─── Evidence shape (mirrors backend wallet evidence dict) ────────────────────

interface WalletIdentity {
  age_days?: number | null;
  balance_native?: string | null;
  tx_count?: number | null;
  first_seen?: string | null;
  last_seen?: string | null;
  is_verified_contract?: boolean | null;
  contract_name?: string | null;
}

interface TokenMarket {
  buy_tax_percent: number | null;
  sell_tax_percent: number | null;
  holder_count: number | null;
  owner_percent: number | null;
  creator_percent: number | null;
  top10_percent: number | null;
  lp_holder_count: number | null;
  lp_locked_percent: number | null;
  liquidity_usd: number | null;
  can_pause_trading: boolean | null;
  can_blacklist: boolean | null;
  can_change_tax: boolean | null;
  cannot_sell_all: boolean | null;
  anti_whale: boolean | null;
}

interface WalletApproval {
  token: string;
  token_symbol?: string | null;
  spender: string;
  spender_flagged: boolean;
  amount: 'unlimited' | string;
  risk_flags: string[];
}

interface WalletContractSecurity {
  honeypot?: boolean | null;
  proxy?: boolean | null;
  mintable?: boolean | null;
  hidden_owner?: boolean | null;
  owner_privileges: string[];
  goplus_flags: string[];
}

interface TokenHolding {
  symbol: string;
  name: string | null;
  balance: string;
  contract: string;
}

interface TokenHoldings {
  tokens: TokenHolding[];
  total_count: number;
}

interface WalletEvidence {
  address: string;
  chain: string;
  address_type: 'eoa' | 'contract';
  identity: WalletIdentity;
  approvals: WalletApproval[];
  contract_security: WalletContractSecurity | null;
  address_security: { flags: string[] };
  risk_score: number;
  red_flags: Array<{ flag: string; weight: number; evidence: string }>;
  green_flags: Array<{ flag: string; label: string; evidence: string }>;
  data_coverage: Record<string, boolean>;
  missing_data: string[];
  token_market?: TokenMarket | null;
  token_holdings?: TokenHoldings | null;
  // Chain auto-detect (new scans): all chains where the address is active,
  // and the active chains other than the one analyzed.
  detected_chains?: string[];
  other_chains_active?: string[];
}

// ─── Aligned key/value row - label fixed 120px dim mono, value aligned ────────
function KVRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12 }}>
      <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', minWidth: 120, flexShrink: 0, fontSize: 11 }}>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

// ─── Format an ISO timestamp as a short readable date in UTC ─────────────────
function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return iso;
  }
}

// ─── Format a decimal string with thousands separators and max 4 decimals ────
function fmtBalance(raw: string): string {
  const n = Number(raw);
  if (!isFinite(n)) return raw;
  // Split at decimal point
  const [intPart, decPart] = n.toFixed(4).split('.');
  const intFormatted = Number(intPart).toLocaleString('en-US');
  // Trim trailing zeros but keep at least none after the dot if all zeros
  const trimmed = decPart ? decPart.replace(/0+$/, '') : '';
  return trimmed ? `${intFormatted}.${trimmed}` : intFormatted;
}

// ─── Format a percent value: 1 decimal, drop trailing ".0" ("5%", "4.2%") ─────
function fmtPct(n: number): string {
  const s = n.toFixed(1);
  return (s.endsWith('.0') ? s.slice(0, -2) : s) + '%';
}

// ─── Risk score bar: high score = riskier (inverted from trust score) ─────────

function RiskScoreRow({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  // 0-33 low risk (green), 34-66 medium risk (amber), 67-100 high risk (red)
  const riskPill = pct <= 33 ? 'good' : pct <= 66 ? 'running' : 'failed';
  const riskLabel = pct <= 33 ? 'low risk' : pct <= 66 ? 'medium risk' : 'high risk';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', minWidth: 120, fontSize: 11 }}>risk score</span>
      <AsciiBar value={pct} />
      <span style={{ color: 'var(--t-text)', fontFamily: 'var(--font-m)', minWidth: 30, textAlign: 'right' }}>{pct}</span>
      <span className={`pill ${riskPill}`}>{riskLabel}</span>
    </div>
  );
}

// ─── Token holdings panel (only rendered when token_holdings is non-null and total_count > 0) ──

function TokenHoldingsPanel({ th }: { th: TokenHoldings }) {
  if (th.total_count === 0) return null;
  return (
    <div className="term-panel">
      <div className="term-panel-head">
        token holdings
        <span style={{ marginLeft: 'auto', color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11 }}>
          {th.total_count} total
        </span>
      </div>
      <div style={{ padding: '4px 0' }}>
        <table className="term-table">
          <thead>
            <tr>
              <th>token</th>
              <th style={{ textAlign: 'right' }}>balance</th>
            </tr>
          </thead>
          <tbody>
            {th.tokens.map((t, i) => (
              <tr key={i}>
                <td>
                  <span style={{ color: 'var(--t-text)', fontFamily: 'var(--font-m)', fontSize: 12 }}>
                    {t.symbol}
                  </span>
                  {t.name != null && (
                    <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-s)', fontSize: 11, marginLeft: 6 }}>
                      {t.name}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-m)', fontSize: 12 }}>
                    {fmtBalance(t.balance)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {th.tokens.length < th.total_count && (
          <div style={{ padding: '6px 14px 8px', color: 'var(--t-dim)', fontFamily: 'var(--font-s)', fontSize: 11 }}>
            showing {th.tokens.length} of {th.total_count}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Token market panel (only rendered when token_market is non-null) ─────────

function TokenMarketPanel({ tm }: { tm: TokenMarket }) {
  // Controls row: collect truthy booleans
  const controls: Array<{ key: keyof TokenMarket; label: string; pill: string }> = [
    { key: 'can_pause_trading', label: 'can pause trading', pill: 'failed' },
    { key: 'can_blacklist',     label: 'can blacklist',     pill: 'failed' },
    { key: 'can_change_tax',    label: 'can change tax',    pill: 'failed' },
    { key: 'cannot_sell_all',   label: 'cannot sell all',   pill: 'failed' },
    { key: 'anti_whale',        label: 'anti whale',        pill: 'paused' },
  ];

  // Only show controls row if at least one capability has a non-null value
  const anyControlKnown = controls.some((c) => tm[c.key] != null);
  const activeControls  = controls.filter((c) => tm[c.key] === true);

  return (
    <div className="term-panel">
      <div className="term-panel-head">token market</div>
      {/* two-column grid; the controls row spans both columns */}
      <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 28, rowGap: 6 }}>

        {/* buy tax */}
        {tm.buy_tax_percent != null && (
          <KVRow label="buy tax">
            <span style={{ color: tm.buy_tax_percent >= 10 ? '#f87171' : tm.buy_tax_percent > 0 ? 'var(--t-text)' : 'var(--t-muted)' }}>
              {fmtPct(tm.buy_tax_percent)}
            </span>
          </KVRow>
        )}

        {/* sell tax */}
        {tm.sell_tax_percent != null && (
          <KVRow label="sell tax">
            <span style={{ color: tm.sell_tax_percent >= 10 ? '#f87171' : tm.sell_tax_percent > 0 ? 'var(--t-text)' : 'var(--t-muted)' }}>
              {fmtPct(tm.sell_tax_percent)}
            </span>
          </KVRow>
        )}

        {/* holder count */}
        {tm.holder_count != null && (
          <KVRow label="holders">
            <span style={{ color: 'var(--t-muted)' }}>{tm.holder_count.toLocaleString()}</span>
          </KVRow>
        )}

        {/* owner holds */}
        {tm.owner_percent != null && (
          <KVRow label="owner holds">
            <span style={{ color: tm.owner_percent >= 20 ? '#f87171' : 'var(--t-muted)' }}>
              {fmtPct(tm.owner_percent)}
            </span>
          </KVRow>
        )}

        {/* creator holds */}
        {tm.creator_percent != null && (
          <KVRow label="creator holds">
            <span style={{ color: 'var(--t-muted)' }}>{fmtPct(tm.creator_percent)}</span>
          </KVRow>
        )}

        {/* top 10 wallet holders - LP pools and contracts excluded backend-side */}
        {tm.top10_percent != null && (
          <KVRow label="top 10 wallets">
            <span style={{ color: tm.top10_percent >= 80 ? '#f87171' : 'var(--t-muted)' }}>
              {fmtPct(tm.top10_percent)}
            </span>
          </KVRow>
        )}

        {/* liquidity */}
        {tm.liquidity_usd != null && (
          <KVRow label="liquidity">
            <span style={{ color: tm.liquidity_usd < 10000 ? '#f87171' : 'var(--t-muted)' }}>
              ${tm.liquidity_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </KVRow>
        )}

        {/* lp locked */}
        {tm.lp_locked_percent != null && (
          <KVRow label="lp locked">
            <span style={{
              color: tm.lp_locked_percent >= 90
                ? 'var(--t-muted)'
                : tm.lp_locked_percent < 30
                ? '#f87171'
                : 'var(--t-text)',
            }}>
              {fmtPct(tm.lp_locked_percent)}
            </span>
            {tm.lp_holder_count != null && (
              <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11 }}>
                {' '}({tm.lp_holder_count} lp holders)
              </span>
            )}
          </KVRow>
        )}

        {/* controls row - spans both grid columns */}
        {anyControlKnown && (
          <div style={{ gridColumn: '1 / -1' }}>
            <KVRow label="controls">
              {activeControls.length === 0 ? (
                <span style={{ color: 'var(--t-muted)', fontSize: 12 }}>none detected</span>
              ) : (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {activeControls.map((c) => (
                    <span key={c.key} className={`pill ${c.pill}`}>{c.label}</span>
                  ))}
                </span>
              )}
            </KVRow>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Evidence panel ───────────────────────────────────────────────────────────

function WalletEvidenceSection({ evidence }: { evidence: WalletEvidence }) {
  const {
    address, chain, address_type, identity, approvals, contract_security,
    address_security, risk_score, red_flags, green_flags, data_coverage, missing_data,
    token_market, token_holdings,
  } = evidence;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* risk score */}
      <div className="term-panel">
        <div className="term-panel-head">risk score</div>
        <div style={{ padding: '12px 14px' }}>
          <RiskScoreRow value={risk_score} />
        </div>
      </div>

      {/* address identity */}
      <div className="term-panel">
        <div className="term-panel-head">
          address
          <span style={{ marginLeft: 'auto' }}>
            <span className="pill active">{address_type === 'eoa' ? 'eoa' : 'contract'}</span>
          </span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <KVRow label="address">
            <span style={{ color: 'var(--t-text)', fontFamily: 'var(--font-m)', fontSize: 11, wordBreak: 'break-all' }}>{address}</span>
          </KVRow>
          <KVRow label="chain">
            <span style={{ color: 'var(--t-muted)' }}>{chain}</span>
            {evidence.other_chains_active && evidence.other_chains_active.length > 0 && (
              <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11 }}>
                {' '}(also active on {evidence.other_chains_active.join(', ')})
              </span>
            )}
          </KVRow>
          {identity.age_days != null && (
            <KVRow label="age">
              <span style={{ color: 'var(--t-muted)' }}>
                {identity.age_days < 30
                  ? `${identity.age_days}d`
                  : identity.age_days < 365
                  ? `${Math.floor(identity.age_days / 30)}mo`
                  : `${Math.floor(identity.age_days / 365)}yr`}
              </span>
            </KVRow>
          )}
          {identity.first_seen && (
            <KVRow label="first seen">
              <span style={{ color: 'var(--t-muted)' }}>{fmtDate(identity.first_seen)}</span>
            </KVRow>
          )}
          {identity.last_seen && (
            <KVRow label="last active">
              <span style={{ color: 'var(--t-muted)' }}>{fmtDate(identity.last_seen)}</span>
            </KVRow>
          )}
          {identity.tx_count != null && (
            <KVRow label="transactions">
              <span style={{ color: 'var(--t-muted)' }}>{identity.tx_count.toLocaleString()}</span>
            </KVRow>
          )}
          {identity.balance_native != null && (
            <KVRow label="balance">
              <span style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-m)', fontSize: 11 }}>{fmtBalance(identity.balance_native)}</span>
            </KVRow>
          )}
          {address_type === 'contract' && identity.is_verified_contract != null && (
            <KVRow label="verified">
              <span style={{
                color: identity.is_verified_contract ? '#4ade80' : '#f87171',
                fontFamily: 'var(--font-m)',
                fontSize: 12,
              }}>
                {identity.is_verified_contract ? 'yes' : 'no'}
              </span>
            </KVRow>
          )}
          {identity.contract_name && (
            <KVRow label="contract name">
              <span style={{ color: 'var(--t-text)', fontFamily: 'var(--font-m)', fontSize: 12 }}>{identity.contract_name}</span>
            </KVRow>
          )}
        </div>
      </div>

      {/* token holdings - non-null and has at least one token */}
      {token_holdings != null && token_holdings.total_count > 0 && (
        <TokenHoldingsPanel th={token_holdings} />
      )}

      {/* token market - only for tokens (non-null token_market) */}
      {token_market != null && <TokenMarketPanel tm={token_market} />}

      {/* flags */}
      {(red_flags.length > 0 || green_flags.length > 0) && (
        <div className="term-panel">
          <div className="term-panel-head">flags</div>
          <div style={{ padding: '4px 0' }}>
            <table className="term-table">
              <thead><tr><th>type</th><th>flag</th><th>evidence</th></tr></thead>
              <tbody>
                {red_flags.map((f, i) => (
                  <tr key={`r${i}`}>
                    <td><span className="pill failed">red</span></td>
                    <td style={{ color: 'var(--t-text)', fontSize: 13, fontFamily: 'var(--font-s)' }}>{f.flag}</td>
                    <td style={{ color: 'var(--t-dim)', fontSize: 11, fontFamily: 'var(--font-m)' }}>{f.evidence}</td>
                  </tr>
                ))}
                {green_flags.map((f, i) => (
                  <tr key={`g${i}`}>
                    <td><span className="pill good">green</span></td>
                    <td style={{ color: 'var(--t-text)', fontSize: 13, fontFamily: 'var(--font-s)' }}>{f.label}</td>
                    <td style={{ color: 'var(--t-dim)', fontSize: 11, fontFamily: 'var(--font-m)' }}>{f.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* address security flags */}
      {address_security.flags.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">address security</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {address_security.flags.map((flag, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--t-muted)' }}>
                <span style={{ color: 'var(--t-dim)' }}>!</span>{' '}{flag}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* token approvals table */}
      {approvals.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">
            token approvals
            <span style={{ marginLeft: 'auto', color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11 }}>
              {approvals.length} total
            </span>
          </div>
          <div style={{ padding: '4px 0' }}>
            <table className="term-table">
              <thead>
                <tr>
                  <th>token</th>
                  <th>spender</th>
                  <th>amount</th>
                  <th>flagged</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((a, i) => (
                  <tr key={i}>
                    <td>
                      {a.token_symbol ? (
                        <>
                          <span style={{ color: 'var(--t-text)', fontFamily: 'var(--font-m)', fontSize: 12 }}>
                            {a.token_symbol}
                          </span>
                          <span
                            style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80, display: 'inline-block', verticalAlign: 'middle' }}
                            title={a.token}
                          >
                            {a.token.slice(0, 6)}…
                          </span>
                        </>
                      ) : (
                        <span
                          style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120, display: 'inline-block' }}
                          title={a.token}
                        >
                          {a.token.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120, display: 'inline-block' }}
                        title={a.spender}
                      >
                        {a.spender.slice(0, 8)}…
                      </span>
                    </td>
                    <td>
                      {a.amount === 'unlimited' ? (
                        <span style={{ color: '#f87171', fontFamily: 'var(--font-m)', fontSize: 12 }}>unlimited</span>
                      ) : (
                        <span style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-m)', fontSize: 12 }}>{a.amount}</span>
                      )}
                    </td>
                    <td>
                      <span className={`pill ${a.spender_flagged ? 'failed' : 'paused'}`}>
                        {a.spender_flagged ? 'yes' : 'no'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* contract security - only shown for contract addresses */}
      {contract_security && (
        <div className="term-panel">
          <div className="term-panel-head">contract security</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* one line: four equal columns, each pair anchored to its column */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {([
                ['honeypot', contract_security.honeypot, 'failed'],
                ['proxy', contract_security.proxy, 'paused'],
                ['mintable', contract_security.mintable, 'paused'],
                ['hidden owner', contract_security.hidden_owner, 'failed'],
              ] as Array<[string, boolean | null | undefined, string]>).map(([label, value, badPill]) =>
                value != null ? (
                  <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11 }}>{label}</span>
                    <span className={`pill ${value ? badPill : 'good'}`}>{value ? 'yes' : 'no'}</span>
                  </span>
                ) : null
              )}
            </div>
            {contract_security.owner_privileges.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  owner privileges
                </div>
                {contract_security.owner_privileges.map((p, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', paddingLeft: 10, lineHeight: 1.7 }}>
                    · {p.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            )}
            {contract_security.goplus_flags.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  security flags
                </div>
                {contract_security.goplus_flags.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', paddingLeft: 10, lineHeight: 1.7 }}>
                    · {f.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* data coverage */}
      {(Object.keys(data_coverage).length > 0 || missing_data.length > 0) && (
        <div className="term-panel">
          <div className="term-panel-head">data coverage</div>
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(data_coverage).map(([key, val]) => (
              <span key={key} className={`pill ${val ? 'active' : 'paused'}`}>{val ? '+' : '-'} {key}</span>
            ))}
            {missing_data.map((m) => (
              <span key={m} className="pill paused">? {m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Parse verdict headline from the report string ───────────────────────────
// Extracts the first paragraph under the first "## Verdict" heading.
// Returns { headline, rest } where `rest` is the report with that paragraph removed.
function parseVerdictHeadline(report: string): { headline: string | null; rest: string } {
  // Match "## Verdict" (case-insensitive) then optional blank lines then a non-blank line
  const match = report.match(/(^|\n)(##\s+Verdict[^\n]*)\n+((?:[^\n#][^\n]*))(\n|$)/i);
  if (!match) return { headline: null, rest: report };

  const headline = match[3].trim();
  // Remove the paragraph AND the "## Verdict" heading itself - the panel head
  // already says "verdict", keeping the h2 would render a duplicate label.
  const rest = report.replace(match[0], `${match[1]}`).replace(/^\s+/, '');
  return { headline, rest };
}

// ─── Verdict + evidence combined view ────────────────────────────────────────

function WalletReportView({ report, evidence }: { report: string; evidence: WalletEvidence | null }) {
  const { headline, rest } = parseVerdictHeadline(report);

  return (
    <>
      <div className="term-panel">
        <div className="term-panel-head">
          verdict
          {evidence?.risk_score != null && (
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-m)', fontSize: 11 }}>
              <span style={{ color: 'var(--t-dim)' }}>risk </span>
              <span style={{ color: 'var(--t-text)' }}>{evidence.risk_score}</span>
            </span>
          )}
        </div>
        <div className="wallet-report" style={{ padding: '14px 14px', maxWidth: '100%' }}>
          {/* Verdict headline: extracted first paragraph under ## Verdict.
              The leading label (CLEAN / LOW RISK / ...) gets a semantic color. */}
          {headline != null && (() => {
            const m = headline.match(/^(CLEAN|LOW RISK|MEDIUM RISK|HIGH RISK)\s*:?\s*(.*)$/i);
            const label = m ? m[1].toUpperCase() : null;
            const restLine = m ? m[2] : headline;
            const labelColor =
              label === 'CLEAN' || label === 'LOW RISK' ? '#4ade80'
              : label === 'MEDIUM RISK' ? 'var(--t-accent)'
              : label === 'HIGH RISK' ? '#f87171'
              : 'var(--t-text)';
            return (
              <div style={{
                color: 'var(--t-text)',
                fontFamily: 'var(--font-s)',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.5,
                marginBottom: 4,
              }}>
                {label && (
                  <span style={{ color: labelColor, fontFamily: 'var(--font-m)', fontSize: 13 }}>
                    {label}:{' '}
                  </span>
                )}
                {restLine}
              </div>
            );
          })()}
          <Markdown>{rest}</Markdown>
        </div>
      </div>
      {/* Scoped styles for wallet-report markdown output */}
      <style>{`
        .wallet-report .body h2 {
          font-size: 11px;
          font-family: var(--font-m);
          text-transform: uppercase;
          letter-spacing: 0.13em;
          color: var(--t-dim);
          margin: 16px 0 8px;
          padding-top: 14px;
          border-top: 1px solid var(--t-border);
          font-weight: 500;
        }
        .wallet-report .body > *:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: none;
        }
        .wallet-report .body p,
        .wallet-report .body li {
          font-size: 13px;
          font-family: var(--font-s);
          color: var(--t-muted);
          line-height: 1.65;
          margin: 0 0 0.45em;
        }
        .wallet-report .body p:last-child { margin-bottom: 0; }
        .wallet-report .body strong {
          color: var(--t-text);
          font-weight: 600;
        }
        .wallet-report .body ul {
          list-style: none;
          padding-left: 2px;
          margin: 4px 0;
        }
        .wallet-report .body li {
          position: relative;
          padding-left: 14px;
        }
        .wallet-report .body li::before {
          content: '·';
          position: absolute;
          left: 0;
          color: var(--t-dim);
          font-family: var(--font-m);
        }
      `}</style>
      {evidence && <WalletEvidenceSection evidence={evidence} />}
    </>
  );
}

// ─── Hydration mapper ─────────────────────────────────────────────────────────

const WALLET_HYDRATION_MAPPER: HydrationMapper<string> = {
  extractReport: (payload) => {
    if (payload.__type__ !== '__wallet_agent_report__') return null;
    return typeof payload.report === 'string' ? payload.report : null;
  },
  extractTarget: (payload) => (typeof payload.address === 'string' ? payload.address : ''),
  extractEvidence: (payload) => payload.evidence ?? null,
};

// ─── Inner page (reads useSearchParams - must be inside Suspense) ─────────────

function WalletPageInner() {
  const searchParams = useSearchParams();
  const hydrationCid = searchParams.get('cid');

  const [addressError, setAddressError] = useState<string | null>(null);

  return (
    <AnalyzerPage<string>
      category="wallet"
      blurb="scan any wallet or contract address for token approvals, risk flags, contract security, and overall risk - chain (ethereum or base) is detected automatically"
      inputLabel="wallet address"
      placeholder="0x..."
      submitLabel="scan wallet"
      busyLabel="scanning..."
      progressTitle="scan in progress"
      failTitle="scan failed"
      hints={HINTS}
      hydrationCid={hydrationCid}
      hydrationMapper={WALLET_HYDRATION_MAPPER}
      extraInputs={() =>
        addressError ? (
          <div style={{ fontSize: 12, color: 'var(--t-muted)' }}>
            <span className="pill failed">err</span>{' '}{addressError}
          </div>
        ) : null
      }
      analyze={async (address, model) => {
        // Validate address before sending to backend
        if (!ADDRESS_RE.test(address.trim())) {
          setAddressError(
            'invalid address - must be 40 hex characters starting with 0x'
          );
          throw Object.assign(
            new Error('invalid address - must be 40 hex characters starting with 0x'),
            { status: 400 }
          );
        }
        setAddressError(null);

        const r = await walletAnalyze(address.trim(), 'auto', model || undefined);
        return {
          job_id: r.job_id,
          cached: r.cached,
          report: r.report,
          evidence: r.evidence,
        };
      }}
      getJob={async (id) => {
        const d = await walletGetJob(id);
        return {
          status: d.status,
          phase_progress: d.phase_progress,
          report: d.report,
          evidence: d.evidence,
          error: d.error,
        };
      }}
      renderReport={(report, ctx: AnalyzerCtx) => (
        <WalletReportView
          report={report}
          evidence={(ctx.evidence as WalletEvidence) ?? null}
        />
      )}
    />
  );
}

// ─── Page export (Suspense boundary required for useSearchParams) ─────────────

export default function WalletPage() {
  return (
    <Suspense>
      <WalletPageInner />
    </Suspense>
  );
}
