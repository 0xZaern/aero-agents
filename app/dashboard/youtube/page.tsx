'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AnalyzerPage, { type AnalyzerCtx, type JobResult, type HydrationMapper } from '@/components/dash/analyzers/AnalyzerPage';
import {
  youtubeAnalyze,
  youtubeGetJob,
  type YouTubeReport,
  type YouTubeEvidence,
  type YouTubeJobStatusResponse,
} from '@/lib/dash/api';

const HINTS = [
  'fetching transcript',
  'reading captions',
  'extracting key points',
  'finding chapters',
  'writing the summary',
];

// ─── Time formatter (seconds to m:ss or h:mm:ss) ──────────────────────────────
function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// api.ts types phase_progress as a Record for legacy reasons; backend returns int.
function normalizeProgress(raw: YouTubeJobStatusResponse['phase_progress']): number {
  if (typeof raw === 'number') return raw as number;
  if (raw && typeof raw === 'object') {
    const vals = Object.values(raw as Record<string, number>);
    return vals.length > 0 ? Math.max(...vals) : 0;
  }
  return 0;
}

// ─── YouTube report render ────────────────────────────────────────────────────
function YouTubeReportView({ report, evidence }: { report: YouTubeReport; evidence: YouTubeEvidence }) {
  const { video } = evidence;
  const videoId = video.video_id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* video header */}
      <div className="term-panel">
        <div className="term-panel-head">
          video
          <span style={{ marginLeft: 'auto' }}><span className="pill active">{report.content_type}</span></span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* title: most prominent element in this panel */}
          <div style={{ fontSize: 14, color: 'var(--t-text)', fontWeight: 600, lineHeight: 1.4, fontFamily: 'var(--font-s)' }}>{video.title}</div>
          {/* channel name */}
          <div style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-m)' }}>{video.channel}</div>
          {/* what_it_is_about: one-line grey description under channel */}
          {report.what_it_is_about && (
            <div style={{ fontSize: 12, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.5 }}>{report.what_it_is_about}</div>
          )}
          {/* meta row: duration, transcript source, language, elapsed */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 3 }}>
            <span style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>
              duration <span style={{ color: 'var(--t-accent)' }}>{fmt(video.duration_seconds)}</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>
              transcript{' '}
              <span className={`pill ${evidence.transcript_source === 'manual_captions' ? 'active' : 'paused'}`}>
                {evidence.transcript_source === 'manual_captions' ? 'manual' : 'auto'}
              </span>
            </span>
            {evidence.language && (
              <span style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>
                lang <span style={{ color: 'var(--t-muted)' }}>{evidence.language}</span>
              </span>
            )}
            {evidence.pipeline_elapsed_seconds > 0 && (
              <span style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>
                analyzed in <span style={{ color: 'var(--t-muted)' }}>{evidence.pipeline_elapsed_seconds.toFixed(1)}s</span>
              </span>
            )}
          </div>
          <div style={{ marginTop: 2 }}>
            <a href={video.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--t-dim)', fontFamily: 'var(--font-m)' }}>{video.url}</a>
          </div>
        </div>
      </div>

      {/* tl;dr -- shows only report.tldr; what_it_is_about is in the video panel above */}
      <div className="term-panel">
        <div className="term-panel-head">tl;dr</div>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 13, color: 'var(--t-text)', lineHeight: 1.7, fontFamily: 'var(--font-s)' }}>{report.tldr}</div>
        </div>
      </div>

      {/* key points */}
      {report.key_points.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">key points</div>
          <div style={{ padding: '4px 0' }}>
            <table className="term-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th>point</th>
                  <th>why it matters</th>
                  <th style={{ width: 60 }}>at</th>
                </tr>
              </thead>
              <tbody>
                {report.key_points.map((kp, i) => (
                  <tr key={i}>
                    {/* row number: dim mono */}
                    <td style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11, width: 28 }}>{i + 1}</td>
                    {/* point text: primary prose */}
                    <td style={{ color: 'var(--t-text)', fontSize: 13, fontFamily: 'var(--font-s)', lineHeight: 1.55 }}>{kp.point}</td>
                    {/* why it matters: secondary, slightly smaller */}
                    <td style={{ color: 'var(--t-muted)', fontSize: 12, fontFamily: 'var(--font-s)', lineHeight: 1.5 }}>{kp.why_matters}</td>
                    {/* timestamp: accent mono anchor */}
                    <td style={{ whiteSpace: 'nowrap', width: 60 }}>
                      {kp.timestamp_seconds != null ? (
                        <a
                          href={`https://youtu.be/${videoId}?t=${kp.timestamp_seconds}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--t-accent)', fontFamily: 'var(--font-m)', fontSize: 11 }}
                        >
                          {fmt(kp.timestamp_seconds)}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 11 }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* causes / background */}
      {report.causes_or_background.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">causes and background</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {report.causes_or_background.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {/* bullet: dim mono */}
                <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 12, lineHeight: 1.55, flexShrink: 0 }}>·</span>
                <span style={{ fontSize: 13, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.55 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* solutions / takeaways */}
      {report.solutions_or_takeaways.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">{report.content_type === 'tutorial' ? 'steps' : 'takeaways'}</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {report.solutions_or_takeaways.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {/* number/bullet: dim mono */}
                <span style={{ color: 'var(--t-dim)', fontFamily: 'var(--font-m)', fontSize: 12, lineHeight: 1.55, flexShrink: 0, minWidth: 18 }}>
                  {report.content_type === 'tutorial' ? `${i + 1}.` : '·'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--t-muted)', fontFamily: 'var(--font-s)', lineHeight: 1.55 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* chapters */}
      {report.chapters.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">chapters</div>
          <div style={{ padding: '4px 0' }}>
            <table className="term-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>time</th>
                  <th>title</th>
                </tr>
              </thead>
              <tbody>
                {report.chapters.map((ch, i) => (
                  <tr key={i}>
                    {/* chapter time: accent mono */}
                    <td style={{ width: 70, whiteSpace: 'nowrap' }}>
                      <a
                        href={`https://youtu.be/${videoId}?t=${ch.start_seconds}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--t-accent)', fontFamily: 'var(--font-m)', fontSize: 11 }}
                      >
                        {fmt(ch.start_seconds)}
                      </a>
                    </td>
                    {/* chapter title: primary text */}
                    <td style={{ color: 'var(--t-text)', fontSize: 13, fontFamily: 'var(--font-s)' }}>{ch.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* notable quotes */}
      {report.quotes.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">notable quotes</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {report.quotes.map((q, i) => (
              <div key={i} style={{ borderLeft: '2px solid var(--t-border-2)', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* quote text: muted italic sans */}
                <div style={{ fontSize: 13, color: 'var(--t-muted)', lineHeight: 1.6, fontStyle: 'italic', fontFamily: 'var(--font-s)' }}>&ldquo;{q.text}&rdquo;</div>
                {/* timestamp: accent mono */}
                {q.timestamp_seconds != null && (
                  <a
                    href={`https://youtu.be/${videoId}?t=${q.timestamp_seconds}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--t-accent)', fontFamily: 'var(--font-m)' }}
                  >
                    @ {fmt(q.timestamp_seconds)}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* topics */}
      {report.topics.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">topics</div>
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {report.topics.map((topic, i) => <span key={i} className="pill active">{topic}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

const YOUTUBE_HYDRATION_MAPPER: HydrationMapper<YouTubeReport> = {
  extractReport: (payload) => {
    if (payload.__type__ !== '__youtube_agent_report__') return null;
    const r = payload.report;
    if (!r || typeof r !== 'object') return null;
    return r as YouTubeReport;
  },
  extractTarget: (payload) => (typeof payload.video_url === 'string' ? payload.video_url : ''),
  extractEvidence: (payload) => payload.evidence ?? null,
};

function YouTubePageInner() {
  const searchParams = useSearchParams();
  const hydrationCid = searchParams.get('cid');

  return (
    <AnalyzerPage<YouTubeReport>
      category="youtube"
      blurb="generate a structured summary of any youtube video via transcript analysis"
      inputLabel="video url"
      placeholder="https://www.youtube.com/watch?v=..."
      submitLabel="analyze video"
      busyLabel="analyzing..."
      progressTitle="analysis in progress"
      failTitle="analysis failed"
      defaultModel="deepseek-v4-flash"
      hints={HINTS}
      doneStatuses={['completed', 'done']}
      hydrationCid={hydrationCid}
      hydrationMapper={YOUTUBE_HYDRATION_MAPPER}
      analyze={async (url, model) => {
        const r = await youtubeAnalyze(url, model || undefined);
        return { job_id: r.job_id, cached: r.cached, report: r.report, evidence: r.evidence };
      }}
      getJob={async (id): Promise<JobResult<YouTubeReport>> => {
        const d = await youtubeGetJob(id);
        return {
          status: d.status,
          phase_progress: normalizeProgress(d.phase_progress),
          report: d.report,
          evidence: d.evidence,
          error: d.error,
        };
      }}
      renderReport={(report, ctx: AnalyzerCtx) =>
        ctx.evidence
          ? <YouTubeReportView report={report} evidence={ctx.evidence as YouTubeEvidence} />
          : null
      }
    />
  );
}

export default function YouTubePage() {
  return (
    <Suspense>
      <YouTubePageInner />
    </Suspense>
  );
}
