'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AnalyzerPage, { type AnalyzerCtx, type HydrationMapper } from '@/components/dash/analyzers/AnalyzerPage';
import { AsciiBar } from '@/components/dash/analyzers/AnalyzerShell';
import {
  legitimacyAnalyze,
  legitimacyGetJob,
} from '@/lib/dash/analyzersApi';

const HINTS = [
  'collecting project data',
  'checking social signals',
  'verifying team',
  'scanning for red flags',
  'computing trust score',
  'writing the report',
];

// ─── Evidence shape (from the legitimacy evidence dict) ───────────────────────
interface EvidenceProject {
  url?: string | null; name?: string | null; stated_purpose?: string | null;
  features?: string[] | null; has_token_claim?: boolean | null;
  token_name?: string | null; token_symbol?: string | null;
}
interface EvidenceWebQuality { ai_slop_score?: number | null; ai_slop_signals?: string[] | null; verdict?: string | null }
interface EvidenceSocial {
  twitter?: { followers?: number | null; account_age_days?: number | null; tweet_count?: number | null; error?: string | null } | null;
  telegram_members?: number | null; github?: Record<string, unknown> | null;
}
interface EvidenceTeam {
  doxxed?: boolean | null; domain_age_days?: number | null;
  linkedin_profiles?: Array<{ url?: string | null; profile_reachable?: boolean | null }>;
}
interface LegitimacyEvidence {
  project?: EvidenceProject; web_quality?: EvidenceWebQuality; social?: EvidenceSocial; team?: EvidenceTeam;
  trust_score?: number | null;
  red_flags?: Array<{ flag: string; weight: number; evidence: string }>;
  green_flags?: Array<{ flag: string; label: string; evidence: string }>;
  data_coverage?: Record<string, boolean>; missing_data?: string[];
}

// ─── Structured verdict JSON schema ───────────────────────────────────────────
interface VerdictWebQuality { label: string; notes: string }
interface VerdictTechUniqueness { label: string; alternatives: string[]; notes: string; trend: string; trend_note: string }
interface VerdictTokenSense { label: string; reasoning: string }
interface VerdictAiConclusion { verdict: string; top_flag: string; verify_yourself: string; summary: string }
interface StructuredVerdict {
  project_description: string;
  what_it_has: string[];
  what_it_lacks: string[];
  web_quality: VerdictWebQuality;
  tech_uniqueness: VerdictTechUniqueness;
  token_sense: VerdictTokenSense;
  team_and_age: string;
  ai_conclusion: VerdictAiConclusion;
  confidence: string;
  confidence_note: string;
}

function tryParseVerdict(report: string): StructuredVerdict | null {
  try {
    const parsed: unknown = JSON.parse(report);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'project_description' in parsed &&
      'ai_conclusion' in parsed
    ) {
      return parsed as StructuredVerdict;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Verdict pill color mapping ───────────────────────────────────────────────
const VERDICT_PILL: Record<string, string> = {
  WORTH_ATTENTION: 'success',
  OK_UNREMARKABLE: 'active',
  LOW_EFFORT:      'running',
  AVOID:           'failed',
  INCONCLUSIVE:    'paused',
};

const CONFIDENCE_PILL: Record<string, string> = {
  high:   'success',
  medium: 'running',
  low:    'paused',
};

// ─── Label row helper: dim mono label + white value + muted notes ─────────────
function LabelRow({ label, value, notes }: { label: string; value: string; notes?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)', textTransform: 'uppercase', letterSpacing: '0.13em', flexShrink: 0 }}>
          {label}
        </span>
        <span style={{ fontSize: 13, color: 'var(--t-text)', fontFamily: 'var(--font-s)' }}>{value}</span>
      </div>
      {notes && (
        <div style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.55, paddingLeft: 0 }}>
          {notes}
        </div>
      )}
    </div>
  );
}

// snake_case enum values from the backend read better as plain words in the UI.
const human = (s: string) => s.replace(/_/g, ' ');

// ─── Structured verdict renderer ─────────────────────────────────────────────
function StructuredVerdictView({ v }: { v: StructuredVerdict }) {
  const verdictPill = VERDICT_PILL[v.ai_conclusion.verdict] ?? 'active';
  const confidencePill = CONFIDENCE_PILL[v.confidence] ?? 'paused';
  const topFlag = v.ai_conclusion.top_flag && v.ai_conclusion.top_flag !== 'none'
    ? v.ai_conclusion.top_flag
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 14px' }}>

      {/* top row: verdict + confidence badges */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={`pill ${verdictPill}`} style={{ fontSize: 12, fontFamily: 'var(--font-m)' }}>
          {v.ai_conclusion.verdict.replace(/_/g, ' ')}
        </span>
        <span className={`pill ${confidencePill}`} style={{ fontSize: 11, fontFamily: 'var(--font-m)' }}>
          {v.confidence} confidence
        </span>
        {topFlag && (
          <span className="pill failed" style={{ fontSize: 11, fontFamily: 'var(--font-m)' }}>
            top flag: {human(topFlag)}
          </span>
        )}
      </div>

      {/* project description */}
      <div style={{ fontSize: 13, color: 'var(--t-text)', fontFamily: 'var(--font-s)', lineHeight: 1.7 }}>
        {v.project_description}
      </div>

      {/* what it has / what it lacks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)', textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: 6 }}>
            what it has
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {v.what_it_has.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 12, lineHeight: 1.55, flexShrink: 0 }}>+</span>
                <span style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.55 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)', textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: 6 }}>
            what it lacks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {v.what_it_lacks.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 12, lineHeight: 1.55, flexShrink: 0 }}>-</span>
                <span style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.55 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* labeled tile rows: web_quality / tech_uniqueness / token_sense */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--t-border)', paddingTop: 12 }}>
        <LabelRow label="web quality" value={human(v.web_quality.label)} notes={v.web_quality.notes} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)', textTransform: 'uppercase', letterSpacing: '0.13em', flexShrink: 0 }}>
              tech uniqueness
            </span>
            <span style={{ fontSize: 13, color: 'var(--t-text)', fontFamily: 'var(--font-s)' }}>{human(v.tech_uniqueness.label)}</span>
            {v.tech_uniqueness.trend && (
              <span style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>
                trend: <span style={{ color: 'var(--t-muted)' }}>{v.tech_uniqueness.trend}</span>
              </span>
            )}
          </div>
          {v.tech_uniqueness.notes && (
            <div style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.55 }}>
              {v.tech_uniqueness.notes}
            </div>
          )}
          {v.tech_uniqueness.trend_note && (
            <div style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-s)', lineHeight: 1.5 }}>
              {v.tech_uniqueness.trend_note}
            </div>
          )}
          {v.tech_uniqueness.alternatives && v.tech_uniqueness.alternatives.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
              {v.tech_uniqueness.alternatives.map((alt, i) => (
                <span key={i} className="term-chip">{alt}</span>
              ))}
            </div>
          )}
        </div>
        <LabelRow label="token sense" value={human(v.token_sense.label)} notes={v.token_sense.reasoning} />
      </div>

      {/* team and age */}
      {v.team_and_age && (
        <div style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.6 }}>
          {v.team_and_age}
        </div>
      )}

      {/* summary */}
      <div style={{ borderTop: '1px solid var(--t-border)', paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)', textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: 6 }}>
          summary
        </div>
        <div style={{ fontSize: 13, color: 'var(--t-text)', fontFamily: 'var(--font-s)', lineHeight: 1.7 }}>
          {v.ai_conclusion.summary}
        </div>
      </div>

      {/* verify yourself */}
      {v.ai_conclusion.verify_yourself && (
        <div style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.55 }}>
          <span style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)', textTransform: 'uppercase', letterSpacing: '0.13em', marginRight: 8 }}>
            verify
          </span>
          {v.ai_conclusion.verify_yourself}
        </div>
      )}

      {/* confidence note */}
      {v.confidence_note && (
        <div style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-s)', lineHeight: 1.5 }}>
          {v.confidence_note}
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', minWidth: 120 }}>{label}</span>
      <AsciiBar value={pct} />
      <span style={{ color: 'var(--t-text)', fontFamily: 'var(--font-m)', minWidth: 30, textAlign: 'right' }}>{max === 1 ? value.toFixed(2) : `${pct}`}</span>
    </div>
  );
}

// Aligned key/value row - label column matches ScoreRow's 120px so every row
// in a panel lines up on the same grid.
function KVRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12 }}>
      <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

function EvidenceSection({ evidence }: { evidence: LegitimacyEvidence }) {
  const proj = evidence.project, web = evidence.web_quality, soc = evidence.social, team = evidence.team;
  const trustScore = evidence.trust_score;
  const redFlags = evidence.red_flags ?? [], greenFlags = evidence.green_flags ?? [];
  const coverage = evidence.data_coverage, missing = evidence.missing_data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {trustScore != null && (
        <div className="term-panel">
          <div className="term-panel-head">trust score</div>
          <div style={{ padding: '12px 14px' }}><ScoreRow label="trust" value={trustScore} max={100} /></div>
        </div>
      )}

      {proj && (proj.name || proj.stated_purpose || proj.features?.length) && (
        <div className="term-panel">
          <div className="term-panel-head">project</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proj.name && (
              <KVRow label="name">
                <span style={{ color: 'var(--t-text)', fontFamily: 'var(--font-s)', fontSize: 13 }}>{proj.name}</span>
              </KVRow>
            )}
            {proj.stated_purpose && (
              <KVRow label="purpose">
                <span style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-s)' }}>{proj.stated_purpose}</span>
              </KVRow>
            )}
            {proj.has_token_claim && proj.token_name && (
              <KVRow label="token">
                <span style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-s)' }}>{proj.token_name}{proj.token_symbol ? ` (${proj.token_symbol})` : ''}</span>
              </KVRow>
            )}
            {proj.features && proj.features.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.13em' }}>
                  stated features
                </div>
                {proj.features.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', paddingLeft: 10, lineHeight: 1.7 }}>· {f}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {web && (
        <div className="term-panel">
          <div className="term-panel-head">web quality</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {web.verdict && (
              <KVRow label="verdict">
                <span style={{ color: 'var(--t-text)', fontFamily: 'var(--font-s)', fontSize: 13 }}>{web.verdict}</span>
              </KVRow>
            )}
            {/* Old reports store slop as a 0-1 fraction, new ones as 0-100. */}
            {web.ai_slop_score != null && (
              <ScoreRow label="ai slop score" value={web.ai_slop_score} max={web.ai_slop_score <= 1 ? 1 : 100} />
            )}
            {web.ai_slop_signals && web.ai_slop_signals.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.13em' }}>
                  slop signals
                </div>
                {web.ai_slop_signals.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', paddingLeft: 10, lineHeight: 1.7 }}>
                    · {s.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {soc && (
        <div className="term-panel">
          <div className="term-panel-head">social signals</div>
          <div style={{ padding: '4px 0' }}>
            <table className="term-table">
              <thead><tr><th>signal</th><th>value</th></tr></thead>
              <tbody>
                {soc.twitter && !soc.twitter.error && (
                  <>
                    {soc.twitter.followers != null && <tr><td>twitter followers</td><td>{soc.twitter.followers.toLocaleString()}</td></tr>}
                    {soc.twitter.account_age_days != null && <tr><td>account age</td><td>{Math.floor(soc.twitter.account_age_days / 30)}m</td></tr>}
                    {soc.twitter.tweet_count != null && <tr><td>tweet count</td><td>{soc.twitter.tweet_count.toLocaleString()}</td></tr>}
                  </>
                )}
                {soc.telegram_members != null && <tr><td>telegram members</td><td>{soc.telegram_members.toLocaleString()}</td></tr>}
                {soc.github && <tr><td>github</td><td>linked</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {team && (team.doxxed != null || team.domain_age_days != null) && (
        <div className="term-panel">
          <div className="term-panel-head">team</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {team.doxxed != null && (
              <KVRow label="doxxed">
                <span className={`pill ${team.doxxed ? 'active' : 'paused'}`}>{team.doxxed ? 'yes' : 'no'}</span>
              </KVRow>
            )}
            {team.domain_age_days != null && (
              <KVRow label="domain age">
                <span style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-s)' }}>
                  {team.domain_age_days < 365
                    ? `${Math.floor(team.domain_age_days / 30)}mo`
                    : `${Math.floor(team.domain_age_days / 365)}yr`}
                </span>
              </KVRow>
            )}
            {team.linkedin_profiles && team.linkedin_profiles.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.13em' }}>
                  linkedin
                </div>
                {team.linkedin_profiles.map((p, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', paddingLeft: 10 }}>
                    · {p.url ?? 'unknown'}{' '}
                    <span className={`pill ${p.profile_reachable ? 'active' : 'paused'}`}>
                      {p.profile_reachable ? 'reachable' : 'unreachable'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(redFlags.length > 0 || greenFlags.length > 0) && (
        <div className="term-panel">
          <div className="term-panel-head">flags</div>
          <div style={{ padding: '4px 0' }}>
            <table className="term-table">
              <thead><tr><th>type</th><th>flag</th><th>evidence</th></tr></thead>
              <tbody>
                {redFlags.map((f, i) => (
                  <tr key={`r${i}`}>
                    <td><span className="pill failed">red</span></td>
                    <td style={{ color: 'var(--t-text)', fontSize: 13, fontFamily: 'var(--font-s)' }}>{human(f.flag)}</td>
                    <td style={{ color: 'var(--t-dim)', fontSize: 11, fontFamily: 'var(--font-m)' }}>{f.evidence}</td>
                  </tr>
                ))}
                {greenFlags.map((f, i) => (
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

      {coverage && (
        <div className="term-panel">
          <div className="term-panel-head">data coverage</div>
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(coverage).map(([key, val]) => (
              <span key={key} className={`pill ${val ? 'active' : 'paused'}`} style={{ fontFamily: 'var(--font-m)', fontSize: 11, borderRadius: 'var(--t-radius-sm)' }}>
                {val ? '+' : '-'} {key}
              </span>
            ))}
            {missing.map((m) => (
              <span key={m} className="pill paused" style={{ fontFamily: 'var(--font-m)', fontSize: 11, borderRadius: 'var(--t-radius-sm)' }}>? {m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LegitimacyReportView({ report, evidence }: { report: string; evidence: LegitimacyEvidence | null }) {
  const structured = tryParseVerdict(report);

  return (
    <>
      <div className="term-panel">
        <div className="term-panel-head">
          verdict
          {evidence?.trust_score != null && (
            <span style={{ marginLeft: 'auto', color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11 }}>
              trust {evidence.trust_score}
            </span>
          )}
        </div>
        {structured ? (
          <StructuredVerdictView v={structured} />
        ) : (
          /* backward-compatible markdown fallback */
          <div style={{ padding: '14px 14px', maxWidth: '100%' }}>
            <pre style={{ margin: 0, fontFamily: 'var(--font-m)', fontSize: 12, lineHeight: 1.65, color: 'var(--t-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'transparent' }}>
              {report}
            </pre>
          </div>
        )}
      </div>
      {evidence && <EvidenceSection evidence={evidence} />}
    </>
  );
}

const LEGITIMACY_HYDRATION_MAPPER: HydrationMapper<string> = {
  extractReport: (payload) => {
    if (payload.__type__ !== '__legitimacy_report__') return null;
    return typeof payload.report === 'string' ? payload.report : null;
  },
  extractTarget: (payload) => (typeof payload.project_url === 'string' ? payload.project_url : ''),
  extractEvidence: (payload) => payload.evidence ?? null,
};

function LegitimacyPageInner() {
  const searchParams = useSearchParams();
  const hydrationCid = searchParams.get('cid');

  return (
    <AnalyzerPage<string>
      category="legitimacy"
      blurb="scan a web3 project for red flags, authenticity signals, and overall legitimacy"
      inputLabel="project url"
      placeholder="https://projectsite.io"
      submitLabel="scan project"
      busyLabel="scanning..."
      progressTitle="scan in progress"
      failTitle="scan failed"
      hints={HINTS}
      hydrationCid={hydrationCid}
      hydrationMapper={LEGITIMACY_HYDRATION_MAPPER}
      analyze={async (url, model) => {
        const r = await legitimacyAnalyze(url, model || undefined);
        return { job_id: r.job_id, cached: r.cached, report: r.report, evidence: r.evidence };
      }}
      getJob={async (id) => {
        const d = await legitimacyGetJob(id);
        return { status: d.status, phase_progress: d.phase_progress, report: d.report, evidence: d.evidence, error: d.error };
      }}
      renderReport={(report, ctx: AnalyzerCtx) => (
        <LegitimacyReportView report={report} evidence={(ctx.evidence as LegitimacyEvidence) ?? null} />
      )}
    />
  );
}

export default function LegitimacyPage() {
  return (
    <Suspense>
      <LegitimacyPageInner />
    </Suspense>
  );
}
