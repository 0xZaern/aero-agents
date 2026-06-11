'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AnalyzerPage, { type AnalyzerCtx, type HydrationMapper } from '@/components/dash/analyzers/AnalyzerPage';
import SlopScore from '@/components/dash/analyzers/SlopScore';
import { AsciiBar } from '@/components/dash/analyzers/AnalyzerShell';
import {
  githubAnalyze,
  githubGetJob,
  type GitHubReport,
} from '@/lib/dash/analyzersApi';

// ─── Verdict badge ────────────────────────────────────────────────────────────
const VERDICT_PILL: Record<string, string> = {
  QUALITY_PROJECT: 'success',
  SOLID_OK:        'active',
  LOW_EFFORT:      'running',
  AI_SLOP:         'failed',
  ABANDONED:       'paused',
  SUSPICIOUS:      'failed',
};

const HINTS = [
  'cloning repository',
  'reading source files',
  'checking commit history',
  'scanning for ai slop',
  'assessing security',
  'writing the verdict',
];

function ScoreBar({ score, label }: { score: number; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      {label && <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', minWidth: 120 }}>{label}</span>}
      <AsciiBar value={score} />
      <span style={{ color: 'var(--t-text)', fontFamily: 'var(--font-m)', minWidth: 38, textAlign: 'right' }}>{score}/100</span>
    </div>
  );
}

function BulletList({ items, prefix = '·' }: { items: string[]; prefix?: string }) {
  if (items.length === 0) return <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 12 }}>none</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', flexShrink: 0, lineHeight: 1.55 }}>{prefix}</span>
          <span style={{ lineHeight: 1.55 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

// ─── GitHub report render ─────────────────────────────────────────────────────
function GitHubReportView({ report, repoUrl }: { report: GitHubReport; repoUrl: string }) {
  const pillClass = VERDICT_PILL[report.verdict] ?? 'active';
  const healthPill: Record<string, string> = { active: 'success', slowing: 'running', dormant: 'paused', abandoned: 'failed' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* verdict header */}
      <div className="term-panel">
        <div className="term-panel-head">
          verdict
          <span style={{ marginLeft: 'auto' }}>
            <span className={`pill ${pillClass}`}>{report.verdict.replace(/_/g, ' ')}</span>
          </span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
            <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>repo</span>
            <a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-m)', fontSize: 11, wordBreak: 'break-all' }}>
              {repoUrl.replace(/^https?:\/\//, '')}
            </a>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
            <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>confidence</span>
            <span className={`pill ${report.confidence === 'high' ? 'success' : report.confidence === 'medium' ? 'running' : 'paused'}`}>
              {report.confidence}
            </span>
          </div>
          {/* what_it_is: primary description, white 13px sans */}
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--t-text)', fontFamily: 'var(--font-s)', lineHeight: 1.65 }}>{report.what_it_is}</div>
        </div>
      </div>

      {/* code quality */}
      <div className="term-panel">
        <div className="term-panel-head">code quality</div>
        <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ScoreBar score={report.code_quality.score} label="quality score" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 6 }}>strengths</div>
              <BulletList items={report.code_quality.strengths} prefix="+" />
            </div>
            <div>
              <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 6 }}>weaknesses</div>
              <BulletList items={report.code_quality.weaknesses} prefix="-" />
            </div>
          </div>
          {report.code_quality.illogical_places.length > 0 && (
            <div>
              <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 6 }}>illogical places</div>
              <BulletList items={report.code_quality.illogical_places} prefix="?" />
            </div>
          )}
        </div>
      </div>

      {/* ai slop - shared SlopScore widget */}
      <div className="term-panel">
        <div className="term-panel-head">ai slop check</div>
        <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SlopScore score={report.ai_slop.readme_score} label="readme slop" />
          <SlopScore score={report.ai_slop.code_score} label="code slop" reasons={report.ai_slop.signals} />
        </div>
      </div>

      {/* security */}
      <div className="term-panel">
        <div className="term-panel-head">security</div>
        <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {report.security.red_flags.length === 0 && report.security.missing.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>no security red flags</div>
          ) : (
            <>
              {report.security.red_flags.length > 0 && (
                <div>
                  <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 6 }}>red flags</div>
                  <BulletList items={report.security.red_flags} prefix="!" />
                </div>
              )}
              {report.security.missing.length > 0 && (
                <div>
                  <div style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 6 }}>missing</div>
                  <BulletList items={report.security.missing} prefix="?" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* activity */}
      <div className="term-panel">
        <div className="term-panel-head">
          activity
          <span style={{ marginLeft: 'auto' }}>
            <span className={`pill ${healthPill[report.activity.health] ?? 'paused'}`}>{report.activity.health}</span>
          </span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
            {/* label: dim mono; value: white */}
            <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>
              last commit{' '}
              <span style={{ color: 'var(--t-text)' }}>{report.activity.last_commit_days_ago}d ago</span>
            </span>
            <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>
              bus factor{' '}
              <span style={{ color: 'var(--t-text)' }}>{report.activity.bus_factor}</span>
            </span>
          </div>
          {report.activity.notes.length > 0 && <BulletList items={report.activity.notes} />}
        </div>
      </div>

      {/* bottom line */}
      <div className="term-panel">
        <div className="term-panel-head">bottom line</div>
        <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--t-text)', fontFamily: 'var(--font-s)', lineHeight: 1.7 }}>{report.bottom_line}</div>
      </div>

      {/* verify yourself */}
      {report.verify_yourself.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">verify yourself</div>
          <div style={{ padding: '4px 0' }}>
            <table className="term-table">
              <thead><tr><th>label</th><th>url</th></tr></thead>
              <tbody>
                {report.verify_yourself.map((link, i) => {
                  const href = link.url.startsWith('http') ? link.url : `https://${link.url}`;
                  return (
                    <tr key={i}>
                      <td>{link.label}</td>
                      <td>
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-m)', fontSize: 11, wordBreak: 'break-all' }}>
                          {link.url.replace(/^https?:\/\//, '')}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* data gaps */}
      {report.data_gaps.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)', padding: '0 2px' }}>
          data gaps: {report.data_gaps.join(', ')} - analysis may be partial
        </div>
      )}
    </div>
  );
}

const GITHUB_HYDRATION_MAPPER: HydrationMapper<GitHubReport> = {
  extractReport: (payload) => {
    if (payload.__type__ !== '__github_agent_report__') return null;
    const r = payload.report;
    if (!r || typeof r !== 'object') return null;
    return r as GitHubReport;
  },
  extractTarget: (payload) => (typeof payload.repo_url === 'string' ? payload.repo_url : ''),
  extractEvidence: (payload) => payload.evidence ?? null,
};

function GitHubPageInner() {
  const searchParams = useSearchParams();
  const hydrationCid = searchParams.get('cid');

  return (
    <AnalyzerPage<GitHubReport>
      category="github"
      blurb="scan a public github repository for code quality, ai slop, security issues, and activity health"
      inputLabel="repository url"
      placeholder="https://github.com/owner/repo"
      submitLabel="scan repository"
      busyLabel="scanning..."
      progressTitle="scan in progress"
      failTitle="scan failed"
      hints={HINTS}
      hydrationCid={hydrationCid}
      hydrationMapper={GITHUB_HYDRATION_MAPPER}
      analyze={(url, model) => githubAnalyze(url, model || undefined)}
      getJob={(id) => githubGetJob(id)}
      renderReport={(report, ctx: AnalyzerCtx) => <GitHubReportView report={report} repoUrl={ctx.submittedUrl} />}
    />
  );
}

export default function GitHubPage() {
  return (
    <Suspense>
      <GitHubPageInner />
    </Suspense>
  );
}
