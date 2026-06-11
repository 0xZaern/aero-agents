'use client';

/**
 * AgentReportCard.tsx
 *
 * Renders one of the five analyzer agent reports in a readable format inside
 * the chat thread. Replaces the raw JSON that was previously shown.
 *
 * Markdown-string reports (legitimacy, wallet) pass through the shared Markdown
 * component. Structured-object reports (github, docs, youtube) are rendered as
 * readable sections using only design tokens from dashboard.css.
 *
 * Design rules: dark terminal tokens only, no pill/circle corners, no em-dashes,
 * no emojis, radius max var(--t-radius-sm), letter-spacing on all uppercase labels.
 */

import Link from 'next/link';
import Markdown from './Markdown';
import type {
  AgentReport,
  GithubReportObject,
  DocsReportObject,
  YoutubeReportObject,
} from '@/lib/dash/agentReport';
import { getAgentReportMeta } from '@/lib/dash/agentReport';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-m)',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--t-dim)',
};

const META_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-m)',
  fontSize: 11,
  color: 'var(--t-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 320,
};

const SECTION_HEAD: React.CSSProperties = {
  fontFamily: 'var(--font-m)',
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--t-dim)',
  marginBottom: 6,
};

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div style={SECTION_HEAD}>{children}</div>;
}

function BulletList({ items, prefix = '-' }: { items: string[]; prefix?: string }) {
  if (!items.length) return null;
  return (
    <ul style={{ margin: '0 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--t-muted)', lineHeight: 1.55 }}>
          <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', flexShrink: 0 }}>{prefix}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--t-dim)', minWidth: 100 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: 'var(--t-border-2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', background: 'var(--t-accent)' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--t-muted)', minWidth: 30, textAlign: 'right' }}>{clamped}/100</span>
    </div>
  );
}

function VerdictPill({ verdict }: { verdict: string }) {
  const v = verdict.toUpperCase();
  let color = 'var(--t-muted)';
  if (v === 'QUALITY_PROJECT' || v === 'SOLID_OK' || v === 'SOLID') color = 'var(--t-accent)';
  else if (v === 'AI_SLOP' || v === 'ABANDONED' || v === 'SUSPICIOUS' || v === 'SLOPPY' || v === 'EMPTY') color = '#c0392b';

  return (
    <span style={{
      fontFamily: 'var(--font-m)',
      fontSize: 10,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color,
      border: `1px solid ${color}`,
      padding: '2px 6px',
      borderRadius: 'var(--t-radius-sm)',
    }}>
      {verdict.replace(/_/g, ' ')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Report-type-specific body renderers
// ---------------------------------------------------------------------------

function GithubReportBody({ report }: { report: GithubReportObject }) {
  const cq = report.code_quality;
  const slop = report.ai_slop;
  const sec = report.security;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* verdict + what it is */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <VerdictPill verdict={report.verdict} />
        {report.confidence && (
          <span style={{ fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--t-dim)' }}>
            confidence: {report.confidence}
          </span>
        )}
      </div>

      {report.what_it_is && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text)', lineHeight: 1.6 }}>
          {report.what_it_is}
        </p>
      )}

      {/* code quality */}
      <div>
        <SectionHead>code quality</SectionHead>
        <ScoreBar value={cq.score} label="quality score" />
        {cq.strengths.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ ...SECTION_HEAD, marginBottom: 4 }}>strengths</div>
            <BulletList items={cq.strengths} prefix="+" />
          </div>
        )}
        {cq.weaknesses.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ ...SECTION_HEAD, marginBottom: 4 }}>weaknesses</div>
            <BulletList items={cq.weaknesses} prefix="-" />
          </div>
        )}
        {cq.illogical_places.length > 0 && (
          <div>
            <div style={{ ...SECTION_HEAD, marginBottom: 4 }}>illogical places</div>
            <BulletList items={cq.illogical_places} prefix="?" />
          </div>
        )}
      </div>

      {/* ai slop */}
      <div>
        <SectionHead>ai slop</SectionHead>
        <ScoreBar value={slop.readme_score} label="readme slop" />
        <ScoreBar value={slop.code_score} label="code slop" />
        {slop.signals.length > 0 && <BulletList items={slop.signals} prefix="·" />}
      </div>

      {/* security */}
      {(sec.red_flags.length > 0 || sec.missing.length > 0) && (
        <div>
          <SectionHead>security</SectionHead>
          {sec.red_flags.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ ...SECTION_HEAD, marginBottom: 4 }}>red flags</div>
              <BulletList items={sec.red_flags} prefix="!" />
            </div>
          )}
          {sec.missing.length > 0 && (
            <div>
              <div style={{ ...SECTION_HEAD, marginBottom: 4 }}>missing</div>
              <BulletList items={sec.missing} prefix="?" />
            </div>
          )}
        </div>
      )}

      {/* activity */}
      {report.activity && (
        <div>
          <SectionHead>activity</SectionHead>
          <div style={{ fontSize: 12, color: 'var(--t-muted)', marginBottom: 6 }}>
            {report.activity.health} &middot; last commit {report.activity.last_commit_days_ago}d ago &middot; bus factor {report.activity.bus_factor}
          </div>
          {report.activity.notes.length > 0 && <BulletList items={report.activity.notes} prefix="·" />}
        </div>
      )}

      {/* bottom line */}
      {report.bottom_line && (
        <div>
          <SectionHead>bottom line</SectionHead>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text)', lineHeight: 1.7 }}>
            {report.bottom_line}
          </p>
        </div>
      )}
    </div>
  );
}

function DocsReportBody({ report }: { report: DocsReportObject }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* verdict */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <VerdictPill verdict={report.verdict} />
        {report.framework && (
          <span style={{ fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--t-dim)' }}>
            {report.framework}
          </span>
        )}
      </div>

      {report.verdictReason && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text)', lineHeight: 1.6 }}>
          {report.verdictReason}
        </p>
      )}

      {/* tldr */}
      {report.tldr && (
        <div>
          <SectionHead>tldr</SectionHead>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text)', lineHeight: 1.65 }}>{report.tldr}</p>
        </div>
      )}

      {/* slop score */}
      <div>
        <SectionHead>slop score</SectionHead>
        <ScoreBar value={report.slopScore} label="slop score" />
        {report.slopReasons && report.slopReasons.length > 0 && (
          <BulletList items={report.slopReasons} prefix="·" />
        )}
      </div>

      {/* summary */}
      {report.summary && (
        <div>
          <SectionHead>summary</SectionHead>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-muted)', lineHeight: 1.65 }}>{report.summary}</p>
        </div>
      )}

      {/* key benefits */}
      {report.keyBenefits.length > 0 && (
        <div>
          <SectionHead>key benefits</SectionHead>
          <BulletList items={report.keyBenefits} prefix="+" />
        </div>
      )}

      {/* red flags */}
      {report.redFlags && report.redFlags.length > 0 && (
        <div>
          <SectionHead>red flags</SectionHead>
          <BulletList items={report.redFlags} prefix="!" />
        </div>
      )}

      {/* tech stack */}
      {report.techStack && report.techStack.length > 0 && (
        <div>
          <SectionHead>tech stack</SectionHead>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {report.techStack.map((t, i) => (
              <span key={i} style={{
                fontFamily: 'var(--font-m)',
                fontSize: 11,
                color: 'var(--t-muted)',
                border: '1px solid var(--t-border-2)',
                padding: '2px 6px',
                borderRadius: 'var(--t-radius-sm)',
              }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* target audience */}
      {report.targetAudience && (
        <div>
          <SectionHead>target audience</SectionHead>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--t-muted)' }}>{report.targetAudience}</p>
        </div>
      )}
    </div>
  );
}

function YoutubeReportBody({ report }: { report: YoutubeReportObject }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* content type */}
      {report.content_type && (
        <div>
          <span style={{
            fontFamily: 'var(--font-m)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--t-dim)',
            border: '1px solid var(--t-border-2)',
            padding: '2px 6px',
            borderRadius: 'var(--t-radius-sm)',
          }}>{report.content_type}</span>
        </div>
      )}

      {/* what it is about */}
      {report.what_it_is_about && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--t-muted)', lineHeight: 1.6 }}>
          {report.what_it_is_about}
        </p>
      )}

      {/* tldr */}
      {report.tldr && (
        <div>
          <SectionHead>tldr</SectionHead>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--t-text)', lineHeight: 1.65, fontWeight: 500 }}>
            {report.tldr}
          </p>
        </div>
      )}

      {/* key points */}
      {report.key_points && report.key_points.length > 0 && (
        <div>
          <SectionHead>key points</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.key_points.map((kp, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--t-dim)', minWidth: 18, paddingTop: 2 }}>{i + 1}.</span>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--t-text)', lineHeight: 1.5 }}>{kp.point}</div>
                  {kp.why_matters && (
                    <div style={{ fontSize: 11, color: 'var(--t-muted)', marginTop: 2 }}>{kp.why_matters}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* causes or background */}
      {report.causes_or_background && report.causes_or_background.length > 0 && (
        <div>
          <SectionHead>background</SectionHead>
          <BulletList items={report.causes_or_background} prefix="·" />
        </div>
      )}

      {/* solutions or takeaways */}
      {report.solutions_or_takeaways && report.solutions_or_takeaways.length > 0 && (
        <div>
          <SectionHead>{report.content_type === 'tutorial' ? 'steps' : 'takeaways'}</SectionHead>
          {report.solutions_or_takeaways.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--t-muted)', lineHeight: 1.55, marginBottom: 4 }}>
              <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', flexShrink: 0 }}>
                {report.content_type === 'tutorial' ? `${i + 1}.` : '·'}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* topics */}
      {report.topics && report.topics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {report.topics.map((t, i) => (
            <span key={i} style={{
              fontFamily: 'var(--font-m)',
              fontSize: 10,
              color: 'var(--t-dim)',
              border: '1px solid var(--t-border-2)',
              padding: '2px 6px',
              borderRadius: 'var(--t-radius-sm)',
            }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function AgentReportCard({ report }: { report: AgentReport }) {
  const meta = getAgentReportMeta(report);

  return (
    <div style={{
      border: '1px solid var(--t-border)',
      borderRadius: 'var(--t-radius-sm)',
      overflow: 'hidden',
      marginTop: 4,
    }}>
      {/* header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 14px',
        borderBottom: '1px solid var(--t-border)',
        background: 'var(--t-bg-2, var(--bg))',
        flexWrap: 'wrap',
      }}>
        <span style={LABEL_STYLE}>{meta.label}</span>
        <span style={META_STYLE} title={meta.metaLine}>{meta.metaLine}</span>
        <Link
          href={meta.consolePath}
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-m)',
            fontSize: 10,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--t-accent)',
            textDecoration: 'none',
            border: '1px solid var(--t-border-2)',
            padding: '3px 8px',
            borderRadius: 'var(--t-radius-sm)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          open in console
        </Link>
      </div>

      {/* body */}
      <div style={{ padding: '14px 14px' }}>
        {report.__type__ === '__legitimacy_report__' && (
          <Markdown>{report.report}</Markdown>
        )}

        {report.__type__ === '__wallet_agent_report__' && (
          <Markdown>{report.report}</Markdown>
        )}

        {report.__type__ === '__github_agent_report__' && (
          <GithubReportBody report={report.report} />
        )}

        {report.__type__ === '__docs_agent_report__' && (
          <DocsReportBody report={report.report} />
        )}

        {report.__type__ === '__youtube_agent_report__' && (
          <YoutubeReportBody report={report.report} />
        )}
      </div>
    </div>
  );
}
