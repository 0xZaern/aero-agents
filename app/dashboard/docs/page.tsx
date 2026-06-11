'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AnalyzerPage, { type HydrationMapper } from '@/components/dash/analyzers/AnalyzerPage';
import SlopScore from '@/components/dash/analyzers/SlopScore';
import {
  docsAnalyze,
  docsGetJob,
  type DocsReport,
} from '@/lib/dash/analyzersApi';

const FRAMEWORK_LABELS: Record<DocsReport['framework'], string> = {
  gitbook: 'GitBook',
  mintlify: 'Mintlify',
  docusaurus: 'Docusaurus',
  generic: 'Generic',
};

const HINTS = [
  'crawling documentation',
  'mapping page hierarchy',
  'extracting code samples',
  'detecting framework',
  'analyzing writing quality',
  'writing the report',
];

// ─── Report render ────────────────────────────────────────────────────────────
function DocsReportView({ report }: { report: DocsReport }) {
  const SOCIALS: { key: keyof DocsReport['socials']; label: string }[] = [
    { key: 'x', label: 'x (twitter)' },
    { key: 'telegram', label: 'telegram' },
    { key: 'discord', label: 'discord' },
    { key: 'github', label: 'github' },
    { key: 'website', label: 'website' },
  ];
  const socialEntries = SOCIALS.filter(({ key }) => !!report.socials[key]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* header - url + framework + audience */}
      <div className="term-panel">
        <div className="term-panel-head">
          source
          <span style={{ marginLeft: 'auto' }}>
            <span className="pill active">{FRAMEWORK_LABELS[report.framework] ?? report.framework}</span>
          </span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* url: accent, small mono, break-all for long paths */}
          <a
            href={report.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: 'var(--t-accent)', fontFamily: 'var(--font-m)', wordBreak: 'break-all' }}
          >
            {report.url}
          </a>
          {report.targetAudience && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              {/* label: dim mono 11px */}
              <span style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)', flexShrink: 0 }}>audience</span>
              {/* text: muted sans 12px */}
              <span style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.5 }}>{report.targetAudience}</span>
            </div>
          )}
        </div>
      </div>

      {/* tl;dr */}
      {report.tldr && (
        <div className="term-panel">
          <div className="term-panel-head">tl;dr</div>
          {/* prose: white text, sans, 13px */}
          <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.7, color: 'var(--t-text)', fontFamily: 'var(--font-s)' }}>{report.tldr}</div>
        </div>
      )}

      {/* slop score */}
      <div className="term-panel">
        <div className="term-panel-head">slop score</div>
        <div style={{ padding: '14px 14px' }}>
          <SlopScore score={report.slopScore} reasons={report.slopReasons} />
        </div>
      </div>

      {/* key benefits */}
      {report.keyBenefits.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">key benefits</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {report.keyBenefits.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                {/* marker box: fixed size, mono, shrink-0 so text wraps in its own column */}
                <span
                  className="pill active"
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    fontFamily: 'var(--font-m)',
                    fontSize: 11,
                    lineHeight: 1,
                  }}
                >
                  +
                </span>
                {/* text: white, sans, 13px */}
                <span style={{ fontSize: 13, color: 'var(--t-text)', fontFamily: 'var(--font-s)', lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* red flags */}
      {report.redFlags.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">red flags</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {report.redFlags.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                {/* marker box: same fixed size as benefits marker for visual consistency */}
                <span
                  className="pill failed"
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    fontFamily: 'var(--font-m)',
                    fontSize: 11,
                    lineHeight: 1,
                  }}
                >
                  !
                </span>
                {/* text: muted, sans, 13px */}
                <span style={{ fontSize: 13, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.6 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* tech stack */}
      {report.techStack.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">tech stack</div>
          {/* term-chip already: mono 11px, radius var(--t-radius-sm), border var(--t-border-2) */}
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {report.techStack.map((t, i) => <span key={i} className="term-chip">{t}</span>)}
          </div>
        </div>
      )}

      {/* links & socials */}
      {socialEntries.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">links &amp; socials</div>
          {/* term-chip with accent override for clickable links */}
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {socialEntries.map(({ key, label }) => (
              <a key={key} href={report.socials[key]} target="_blank" rel="noopener noreferrer" className="term-chip" style={{ color: 'var(--t-accent)' }}>
                {label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* summary - prose block, not mono pre */}
      {report.summary && (
        <div className="term-panel">
          <div className="term-panel-head">summary</div>
          {/* same sans prose style as tl;dr: muted, 13px, pre-wrap for newlines */}
          <div
            style={{
              padding: '12px 14px',
              fontSize: 13,
              lineHeight: 1.65,
              color: 'var(--t-muted)',
              fontFamily: 'var(--font-s)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {report.summary}
          </div>
        </div>
      )}
    </div>
  );
}

const DOCS_HYDRATION_MAPPER: HydrationMapper<DocsReport> = {
  extractReport: (payload) => {
    if (payload.__type__ !== '__docs_agent_report__') return null;
    const r = payload.report;
    if (!r || typeof r !== 'object') return null;
    return r as DocsReport;
  },
  // The top-level `url` field in the stored payload matches the target input.
  extractTarget: (payload) => (typeof payload.url === 'string' ? payload.url : ''),
  extractEvidence: (payload) => payload.evidence ?? null,
};

function DocsAgentPageInner() {
  const searchParams = useSearchParams();
  const hydrationCid = searchParams.get('cid');

  return (
    <AnalyzerPage<DocsReport>
      category="docs"
      blurb="analyze any documentation site - slop score, structure, tech stack, and key insights"
      inputLabel="documentation url"
      placeholder="https://docs.example.com"
      submitLabel="analyze docs"
      busyLabel="analyzing..."
      progressTitle="analysis in progress"
      failTitle="analysis failed"
      proGated
      hints={HINTS}
      hydrationCid={hydrationCid}
      hydrationMapper={DOCS_HYDRATION_MAPPER}
      analyze={(url, model) => docsAnalyze(url, model || undefined)}
      getJob={(id) => docsGetJob(id)}
      renderReport={(report) => <DocsReportView report={report} />}
    />
  );
}

export default function DocsAgentPage() {
  return (
    <Suspense>
      <DocsAgentPageInner />
    </Suspense>
  );
}
