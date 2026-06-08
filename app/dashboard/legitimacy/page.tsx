'use client';

import AnalyzerPage, { type AnalyzerCtx } from '@/components/dash/analyzers/AnalyzerPage';
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

function ScoreRow({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span style={{ color: 'var(--text-dim)', minWidth: 120 }}>{label}</span>
      <AsciiBar value={pct} />
      <span style={{ color: 'var(--text-muted)', minWidth: 30, textAlign: 'right' }}>{max === 1 ? value.toFixed(2) : `${pct}`}</span>
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
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {proj.name && <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-dim)' }}>name</span> <span style={{ color: 'var(--text)' }}>{proj.name}</span></div>}
            {proj.stated_purpose && <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-dim)' }}>purpose</span> <span style={{ color: 'var(--text-muted)' }}>{proj.stated_purpose}</span></div>}
            {proj.has_token_claim && proj.token_name && (
              <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-dim)' }}>token</span> <span style={{ color: 'var(--text-muted)' }}>{proj.token_name}{proj.token_symbol ? ` (${proj.token_symbol})` : ''}</span></div>
            )}
            {proj.features && proj.features.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>stated features</div>
                {proj.features.map((f, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 10 }}>· {f}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {web && (
        <div className="term-panel">
          <div className="term-panel-head">web quality</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {web.verdict && <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-dim)' }}>verdict</span> <span style={{ color: 'var(--text)' }}>{web.verdict}</span></div>}
            {web.ai_slop_score != null && <ScoreRow label="ai slop score" value={web.ai_slop_score} max={1} />}
            {web.ai_slop_signals && web.ai_slop_signals.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>slop signals</div>
                {web.ai_slop_signals.map((s, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 10 }}>· {s.replace(/_/g, ' ')}</div>)}
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
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {team.doxxed != null && (
              <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-dim)' }}>doxxed</span> <span className={`pill ${team.doxxed ? 'active' : 'paused'}`}>{team.doxxed ? 'yes' : 'no'}</span></div>
            )}
            {team.domain_age_days != null && (
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-dim)' }}>domain age</span>{' '}
                <span style={{ color: 'var(--text-muted)' }}>{team.domain_age_days < 365 ? `${Math.floor(team.domain_age_days / 30)}mo` : `${Math.floor(team.domain_age_days / 365)}yr`}</span>
              </div>
            )}
            {team.linkedin_profiles && team.linkedin_profiles.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>linkedin</div>
                {team.linkedin_profiles.map((p, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 10 }}>
                    · {p.url ?? 'unknown'} <span className={`pill ${p.profile_reachable ? 'active' : 'paused'}`}>{p.profile_reachable ? 'reachable' : 'unreachable'}</span>
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
                {redFlags.map((f, i) => <tr key={`r${i}`}><td><span className="pill failed">red</span></td><td>{f.flag}</td><td style={{ color: 'var(--text-dim)', fontSize: 11 }}>{f.evidence}</td></tr>)}
                {greenFlags.map((f, i) => <tr key={`g${i}`}><td><span className="pill success">green</span></td><td>{f.label}</td><td style={{ color: 'var(--text-dim)', fontSize: 11 }}>{f.evidence}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {coverage && (
        <div className="term-panel">
          <div className="term-panel-head">data coverage</div>
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(coverage).map(([key, val]) => <span key={key} className={`pill ${val ? 'active' : 'paused'}`}>{val ? '+' : '-'} {key}</span>)}
            {missing.map((m) => <span key={m} className="pill paused">? {m}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

function LegitimacyReportView({ report, evidence }: { report: string; evidence: LegitimacyEvidence | null }) {
  return (
    <>
      <div className="term-panel">
        <div className="term-panel-head">
          verdict
          {evidence?.trust_score != null && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 11 }}>trust {evidence.trust_score}</span>
          )}
        </div>
        <div style={{ padding: '14px 14px', maxWidth: '100%' }}>
          <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'transparent' }}>
            {report}
          </pre>
        </div>
      </div>
      {evidence && <EvidenceSection evidence={evidence} />}
    </>
  );
}

export default function LegitimacyPage() {
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
