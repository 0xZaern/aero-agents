'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/dash/stores/chatStore';
import ProGate from '@/components/dash/ProGate';
import { phaseLabel, usePoller, ALLOWED_MODELS } from './AnalyzerShell';
import { getConversationMessages, getConversations, getAgents } from '@/lib/dash/api';
import { parseAgentReport } from '@/lib/dash/agentReport';
import { AGENT_CONSOLE_ROUTE } from '@/lib/dash/agentConsoles';

// Square back-to-chat arrow button shown left of every console header.
function BackToChat() {
  const router = useRouter();
  const setSelectedAgentId = useChatStore((s) => s.setSelectedAgentId);
  return (
    <button
      className="term-btn ghost"
      title="back to chat"
      aria-label="back to chat"
      style={{
        width: 30,
        height: 'auto',
        alignSelf: 'stretch',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      onClick={() => { setSelectedAgentId(null); router.push('/dashboard/chat'); }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
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

// Each console page provides this to map a stored AgentReport payload onto the
// types that its renderReport function expects.
export interface HydrationMapper<R> {
  // Return the typed report value (R) from the stored payload, or null if the
  // payload is not the right type for this page.
  extractReport: (payload: Record<string, unknown>) => R | null;
  // Return the target string (address / URL / etc.) to prefill the input.
  extractTarget: (payload: Record<string, unknown>) => string;
  // Return the evidence value to pass through ctx.evidence.
  extractEvidence: (payload: Record<string, unknown>) => unknown;
  // Optional: called after state is set so the page can sync extra local state
  // (e.g. the wallet chain selector).
  onHydrated?: (payload: Record<string, unknown>) => void;
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
  // Optional extra controls rendered between the main text input and the
  // model/submit row. Used by pages that need additional selects (e.g. chain).
  extraInputs?: (disabled: boolean) => React.ReactNode;
  analyze: (target: string, model: string) => Promise<AnalyzeResult<R>>;
  getJob: (id: string) => Promise<JobResult<R>>;
  renderReport: (report: R, ctx: AnalyzerCtx) => React.ReactNode;
  // When the page was opened from the chat sidebar via ?cid=<conversationId>,
  // this is the conversation id to hydrate from.
  hydrationCid?: string | null;
  // Mapper that bridges the stored JSON payload to this page's report/evidence
  // types. Required when hydrationCid may be provided.
  hydrationMapper?: HydrationMapper<R>;
}

export default function AnalyzerPage<R>({
  category, blurb, inputLabel, placeholder, submitLabel, busyLabel,
  progressTitle, failTitle, proGated, hints, doneStatuses = ['done'],
  failedStatuses = ['failed'], defaultModel = 'claude-sonnet-4-6',
  extraInputs, analyze, getJob, renderReport,
  hydrationCid, hydrationMapper,
}: AnalyzerPageProps<R>) {
  const [target, setTarget] = useState('');
  const [model, setModel] = useState(defaultModel);
  // True once the user manually picks a model, so the agent-default load below
  // never clobbers an explicit choice.
  const modelTouchedRef = useRef(false);

  // Default the model picker to whatever this category's preset agent is
  // configured to use (mirrors the model shown in the chat composer dropdown /
  // what the user set in the agents section). Falls back to `defaultModel`.
  useEffect(() => {
    let cancelled = false;
    const agentName = Object.keys(AGENT_CONSOLE_ROUTE).find(
      (n) => AGENT_CONSOLE_ROUTE[n] === `/dashboard/${category}`
    );
    if (!agentName) return;
    getAgents('presets')
      .then((agents) => {
        if (cancelled || modelTouchedRef.current) return;
        const a = agents.find((x) => x.name === agentName);
        if (a?.modelId && ALLOWED_MODELS.some((m) => m.id === a.modelId)) {
          setModel(a.modelId);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [category]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProError, setIsProError] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submittedUrl, setSubmittedUrl] = useState('');
  const [cached, setCached] = useState(false);
  const [job, setJob] = useState<JobResult<R> | null>(null);

  const jobIdRef = useRef<string | null>(null);
  // True while a stored conversation is being loaded into the console.
  const [hydrating, setHydrating] = useState<boolean>(false);

  const isTerminal = (s?: JobResult<R> | null) =>
    !!s && (doneStatuses.includes(s.status) || failedStatuses.includes(s.status));

  // ── Conversation hydration ──────────────────────────────────────────────
  // Opened via ?cid=<id> from the sidebar: restore the saved report.
  // Fast path: the chat message cache (localStorage, warmed by the chat
  // prefetcher) - renders instantly with zero network. Slow path: one fetch.
  // Hydration is idempotent, so StrictMode double-runs are harmless; the only
  // real guard needed is "don't overwrite an in-flight scan" (jobIdRef).
  useEffect(() => {
    if (!hydrationCid || !hydrationMapper) return;

    let cancelled = false;

    const apply = (msgs: { role: string; content: string }[]): boolean => {
      if (cancelled || jobIdRef.current) return false;
      const reportMsg = [...msgs].reverse().find(
        (m) => m.role === 'assistant' && parseAgentReport(m.content) !== null
      );
      if (!reportMsg) return false;
      const payload = parseAgentReport(reportMsg.content) as unknown as Record<string, unknown>;
      const report = hydrationMapper.extractReport(payload);
      if (report === null) return false;

      setTarget(hydrationMapper.extractTarget(payload));
      setSubmittedUrl(hydrationMapper.extractTarget(payload));
      setCached(false);
      setJob({
        status: doneStatuses[0],
        phase_progress: 100,
        report,
        evidence: hydrationMapper.extractEvidence(payload),
        error: null,
      });
      hydrationMapper.onHydrated?.(payload);
      return true;
    };

    // Fast path: cached messages render with no loading state at all.
    const cachedMsgs = useChatStore.getState().messageCache[hydrationCid];
    if (cachedMsgs?.length && apply(cachedMsgs)) return;

    // Slow path: fetch once, prime the cache for next time.
    setHydrating(true);
    getConversationMessages(hydrationCid)
      .then((msgs) => {
        useChatStore.getState().primeCache(hydrationCid, msgs);
        apply(msgs);
      })
      .catch(() => { /* silent - console stays blank */ })
      .finally(() => { if (!cancelled) setHydrating(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationCid]);

  const fetchStatus = useCallback(async () => {
    const id = jobIdRef.current;
    if (!id) return;
    try {
      const next = await getJob(id);
      setJob(next);
      // Scans save a conversation server-side; refresh the sidebar list once
      // the job reaches a terminal state so the new entry appears immediately.
      if (doneStatuses.includes(next.status) || failedStatuses.includes(next.status)) {
        getConversations()
          .then((list) => useChatStore.getState().setConversations(list))
          .catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'polling failed');
    }
  }, [getJob, doneStatuses, failedStatuses]);

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
    // Block any still-pending hydration from overwriting the new scan.
    jobIdRef.current = '__pending__';
    setHydrating(false);
    stopPoller();

    try {
      const resp = await analyze(t, model || '');
      setSubmittedUrl(t);

      if (resp.cached && resp.report != null) {
        setCached(true);
        setJobId(resp.job_id);
        setJob({ status: doneStatuses[0], phase_progress: 100, report: resp.report, evidence: resp.evidence, error: null });
        setLoading(false);
        // Cached results may still have created/updated a conversation.
        getConversations()
          .then((list) => useChatStore.getState().setConversations(list))
          .catch(() => {});
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
      <div className="term-pad" style={{ maxWidth: 860, marginLeft: 'auto', marginRight: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* header with inline back button */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
          <BackToChat />
          <div>
            <div style={{ fontFamily: 'var(--font-m)', color: 'var(--t-dim)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
              analyzer / {category}
            </div>
            <div style={{ fontFamily: 'var(--font-m)', color: 'var(--t-muted)', fontSize: 12 }}>{blurb}</div>
          </div>
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
            {extraInputs && extraInputs(loading || inFlight)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>model</span>
              <select
                className="term-input"
                value={model}
                onChange={(e) => { modelTouchedRef.current = true; setModel(e.target.value); }}
                disabled={loading || inFlight}
                style={{ width: 'auto', padding: '5px 26px 5px 9px', fontSize: 12 }}
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

        {/* restoring a saved session (opened from sidebar history) */}
        {hydrating && !job && !error && (
          <div className="term-panel">
            <div className="term-panel-head">loading session</div>
            <div style={{ padding: 14, fontFamily: 'var(--font-m)', fontSize: 12, color: 'var(--t-dim)', textAlign: 'center' }}>
              restoring saved report<span className="term-caret" />
            </div>
          </div>
        )}

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
                {/* full-width segmented progress bar (terminal block style) */}
                <div style={{ flex: 1, height: 12, border: '1px solid var(--t-border-2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: 'repeating-linear-gradient(90deg, var(--t-muted) 0 8px, transparent 8px 11px)',
                      transition: 'width 1.2s ease',
                    }}
                  />
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-m)', fontSize: 12, color: 'var(--t-dim)', textAlign: 'center' }}>
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
