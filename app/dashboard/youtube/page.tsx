'use client';

import AnalyzerPage, { type AnalyzerCtx, type JobResult } from '@/components/dash/analyzers/AnalyzerPage';
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
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.4 }}>{video.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{video.channel}</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>duration <span style={{ color: 'var(--text-muted)' }}>{fmt(video.duration_seconds)}</span></span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              transcript{' '}
              <span className={`pill ${evidence.transcript_source === 'manual_captions' ? 'active' : 'paused'}`}>
                {evidence.transcript_source === 'manual_captions' ? 'manual' : 'auto'}
              </span>
            </span>
            {evidence.language && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>lang <span style={{ color: 'var(--text-muted)' }}>{evidence.language}</span></span>}
            {evidence.pipeline_elapsed_seconds > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>analyzed in <span style={{ color: 'var(--text-muted)' }}>{evidence.pipeline_elapsed_seconds.toFixed(1)}s</span></span>
            )}
          </div>
          <div style={{ marginTop: 4 }}>
            <a href={video.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{video.url}</a>
          </div>
        </div>
      </div>

      {/* tl;dr */}
      <div className="term-panel">
        <div className="term-panel-head">tl;dr</div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65 }}>{report.what_it_is_about}</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, fontWeight: 500 }}>{report.tldr}</div>
        </div>
      </div>

      {/* key points */}
      {report.key_points.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">key points</div>
          <div style={{ padding: '4px 0' }}>
            <table className="term-table">
              <thead><tr><th>#</th><th>point</th><th>why it matters</th><th>at</th></tr></thead>
              <tbody>
                {report.key_points.map((kp, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-dim)', width: 28 }}>{i + 1}</td>
                    <td>{kp.point}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: 11 }}>{kp.why_matters}</td>
                    <td style={{ whiteSpace: 'nowrap', width: 60 }}>
                      {kp.timestamp_seconds != null ? (
                        <a href={`https://youtu.be/${videoId}?t=${kp.timestamp_seconds}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          {fmt(kp.timestamp_seconds)}
                        </a>
                      ) : '-'}
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
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {report.causes_or_background.map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text-dim)' }}>·</span><span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* solutions / takeaways */}
      {report.solutions_or_takeaways.length > 0 && (
        <div className="term-panel">
          <div className="term-panel-head">{report.content_type === 'tutorial' ? 'steps' : 'takeaways'}</div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {report.solutions_or_takeaways.map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text-dim)', minWidth: 20 }}>{report.content_type === 'tutorial' ? `${i + 1}.` : '·'}</span>
                <span>{item}</span>
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
              <thead><tr><th>time</th><th>title</th></tr></thead>
              <tbody>
                {report.chapters.map((ch, i) => (
                  <tr key={i}>
                    <td style={{ width: 70, whiteSpace: 'nowrap' }}>
                      <a href={`https://youtu.be/${videoId}?t=${ch.start_seconds}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {fmt(ch.start_seconds)}
                      </a>
                    </td>
                    <td>{ch.title}</td>
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
              <div key={i} style={{ borderLeft: '2px solid var(--border-strong)', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{q.text}&rdquo;</div>
                {q.timestamp_seconds != null && (
                  <a href={`https://youtu.be/${videoId}?t=${q.timestamp_seconds}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
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

export default function YouTubePage() {
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
      hints={HINTS}
      doneStatuses={['completed', 'done']}
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
