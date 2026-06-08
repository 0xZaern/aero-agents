'use client';

import AnalyzerPage from '@/components/dash/analyzers/AnalyzerPage';
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
          <a href={report.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--t-accent)', wordBreak: 'break-all' }}>
            {report.url}
          </a>
          {report.targetAudience && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text-dim)' }}>audience</span>{' '}
              <span style={{ color: 'var(--text-muted)' }}>{report.targetAudience}</span>
            </div>
          )}
        </div>
      </div>

      {/* tl;dr */}
      {report.tldr && (
        <div className="term-panel">
          <div className="term-panel-head">tl;dr</div>
          <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{report.tldr}</div>
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
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {report.keyBenefits.map((b, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <span className="pill success" style={{ marginRight: 6 }}>+</span>{b}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* red flags */}
      {report.redFlags.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">red flags</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {report.redFlags.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <span className="pill failed" style={{ marginRight: 6 }}>!</span>{f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* tech stack */}
      {report.techStack.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">tech stack</div>
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {report.techStack.map((t, i) => <span key={i} className="term-chip">{t}</span>)}
          </div>
        </div>
      )}

      {/* links & socials */}
      {socialEntries.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">links &amp; socials</div>
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {socialEntries.map(({ key, label }) => (
              <a key={key} href={report.socials[key]} target="_blank" rel="noopener noreferrer" className="term-chip" style={{ color: 'var(--t-accent)' }}>
                {label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* summary */}
      {report.summary && (
        <div className="term-panel">
          <div className="term-panel-head">summary</div>
          <div style={{ padding: '14px 14px' }}>
            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'transparent' }}>
              {report.summary}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocsAgentPage() {
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
      analyze={(url, model) => docsAnalyze(url, model || undefined)}
      getJob={(id) => docsGetJob(id)}
      renderReport={(report) => <DocsReportView report={report} />}
    />
  );
}
