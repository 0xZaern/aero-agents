'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/dash/stores/chatStore';
import ProGate from '@/components/dash/ProGate';
import { AsciiBar, phaseLabel, usePoller, ALLOWED_MODELS } from './AnalyzerShell';

// "← back to chat" control shown atop every console.
function BackToChat() {
  const router = useRouter();
  const setSelectedAgentId = useChatStore((s) => s.setSelectedAgentId);
  return (
    <button
      className="term-btn ghost"
      style={{ alignSelf: 'flex-start', fontSize: 12, padding: '4px 10px' }}
      onClick={() => { setSelectedAgentId(null); router.push('/dashboard/chat'); }}
    >
      ← back to chat
    </button>
  );
}

// Shared scaffolding for every job-poll analyzer (docs / github / youtube /
// legitimacy). Each page supplies its analyze/getJob calls, copy, and a
// report renderer; everything else (input, model picker, polling, error +
// PRO upsell, progress with cycling hints, cached badge) lives here.

export interface AnalyzeResult<R> {
  job_id: string;
  cached: boolean;
  report: R | null;
  evidence?: unknown;
}

export interface JobResult<R> {
  status: string;
  phase_progress: number;
  report: R | null;
  evidence?: unknown;
  error: string | null;
}

export interface AnalyzerCtx {
  evidence: unknown;
  submittedUrl: string;
  cached: boolean;
}

interface AnalyzerPageProps<R> {
  category: string;          // "github"
  blurb: string;
  inputLabel: string;        // "repository url"
  placeholder: string;
  submitLabel: string;       // "scan repository"
  busyLabel: string;         // "scanning..."
  progressTitle: string;     // "scan in progress"
  failTitle: string;         // "scan failed"
  proGated?: boolean;
  hints?: string[];          // rotating status lines shown while in flight
  doneStatuses?: string[];   // default ['done']
  failedStatuses?: string[]; // default ['failed']
  defaultModel?: string;
  analyze: (target: string, model: string) => Promise<AnalyzeResult<R>>;
  getJob: (id: string) => Promise<JobResult<R>>;
  renderReport: (report: R, ctx: AnalyzerCtx) => React.ReactNode;
}

export default function AnalyzerPage<R>({
  category, blurb, inputLabel, placeholder, submitLabel, busyLabel,
  progressTitle, failTitle, proGated, hints, doneStatuses = ['done'],
  failedStatuses = ['failed'], defaultModel = 'claude-sonnet-4-6',
  analyze, getJob, renderReport,
}: AnalyzerPageProps<R>) {
  const [target, setTarget] = useState('');
  const [model, setModel] = useState(defaultModel);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProError, setIsProError] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submittedUrl, setSubmittedUrl] = useState('');
  const [cached, setCached] = useState(false);
  const [job, setJob] = useState<JobResult<R> | null>(null);

  const jobIdRef = useRef<string | null>(null);
  const isTerminal = (s?: JobResult<R> | null) =>
    !!s && (doneStatuses.includes(s.status) || failedStatuses.includes(s.status));

  const fetchStatus = useCallback(async () => {
    const id = jobIdRef.current;
    if (!id) return;
    try {
      setJob(await getJob(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'polling failed');
    }
  }, [getJob]);

  const { start: startPoller, stop: stopPoller } = usePoller(
    fetchStatus,
    () => isTerminal(job),
    2000,
  );

  const handleSubmit = useCallback(async () => {
    const t = target.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    setIsProError(false);
    setJob(null);
    setJobId(null);
    setCached(false);
    jobIdRef.current = null;
    stopPoller();

    try {
      const resp = await analyze(t, model || '');
      setSubmittedUrl(t);

      if (resp.cached && resp.report != null) {
        setCached(true);
        setJobId(resp.job_id);
        setJob({ status: doneStatuses[0], phase_progress: 100, report: resp.report, evidence: resp.evidence, error: null });
        setLoading(false);
        return;
      }

      setJobId(resp.job_id);
      jobIdRef.current = resp.job_id;
      setJob({ status: 'queued', phase_progress: 0, report: null, evidence: null, error: null });
      startPoller();
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 402 || status === 403) {
        setIsProError(true);
        setError(`${category} is a PRO feature - upgrade to unlock unlimited analyses.`);
      } else {
        setError(e instanceof Error ? e.message : 'submit failed');
      }
    } finally {
      setLoading(false);
    }
  }, [target, model, analyze, stopPoller, startPoller, doneStatuses, category]);

  const status = job?.status ?? '';
  const progress = job?.phase_progress ?? 0;
  const done = doneStatuses.includes(status);
  const failed = failedStatuses.includes(status);
  const inFlight = !!jobId && !done && !failed;

  // ── Rotating hint line while in flight (cheap "feels alive" feedback) ──
  const [hintIdx, setHintIdx] = useState(0);
  useEffect(() => {
    if (!inFlight || !hints || hints.length === 0) return;
    const id = setInterval(() => setHintIdx((i) => (i + 1) % hints.length), 2500);
    return () => clearInterval(id);
  }, [inFlight, hints]);
  const hintLine = hints && hints.length > 0 ? hints[hintIdx % hints.length] : 'analyzing';

  return (
    <ProGate feature="Agents">
    <div className="term-scroll">
      <div className="term-pad" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 18 }}>

        <BackToChat />

        {/* header */}
        <div>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
            analyzer / {category}
          </div>
          <div style={{ color: 'var(--text)', fontSize: 13 }}>{blurb}</div>
        </div>

        {/* input */}
        <div className="term-panel">
          <div className="term-panel-head">{inputLabel}</div>
          <div style={{ padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              className="term-input"
              type="text"
              placeholder={placeholder}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={loading || inFlight}
              aria-label={inputLabel}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>model</span>
              <select
                className="term-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={loading || inFlight}
                style={{ width: 'auto', padding: '5px 9px', fontSize: 12 }}
                aria-label="model"
              >
                {ALLOWED_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <div style={{ flex: 1 }} />
              <button className="term-btn" onClick={handleSubmit} disabled={!target.trim() || loading || inFlight}>
                {loading ? 'starting...' : inFlight ? busyLabel : submitLabel}
              </button>
            </div>
          </div>
        </div>

        {/* error (+ PRO upsell) */}
        {error && (
          <div className="term-panel">
            <div className="term-panel-head">{isProError ? 'pro feature' : 'error'}</div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                <span className="pill failed">{isProError ? 'pro' : 'err'}</span>{' '}{error}
              </div>
              {(isProError || proGated) && isProError && (
                <Link href="/dashboard/billing" className="term-btn primary" style={{ width: 'fit-content', fontSize: 12 }}>
                  upgrade to pro
                </Link>
              )}
            </div>
          </div>
        )}

        {/* progress */}
        {inFlight && (
          <div className="term-panel">
            <div className="term-panel-head">
              {progressTitle}
              <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>{progress}%</span>
            </div>
            <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--text-dim)', fontSize: 11, minWidth: 120 }}>{phaseLabel(status)}</span>
                <AsciiBar value={progress} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {hintLine}<span className="term-caret" />
              </div>
            </div>
          </div>
        )}

        {/* failed */}
        {failed && job?.error && (
          <div className="term-panel">
            <div className="term-panel-head">{failTitle}</div>
            <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
              <span className="pill failed">failed</span>{' '}{job.error}
            </div>
          </div>
        )}

        {/* report */}
        {done && job?.report && (
          <>
            {cached && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pill active">cached</span> instant result from a previous scan
              </div>
            )}
            {renderReport(job.report, { evidence: job.evidence, submittedUrl, cached })}
          </>
        )}
      </div>
    </div>
    </ProGate>
  );
}
