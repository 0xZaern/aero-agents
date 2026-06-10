// Typed API wrappers for /api/legitimacy and /api/github-agent
// Replicates the same lightweight request() pattern from scheduledTasks.ts.
// Does NOT need 'use client' - it is a plain module imported by client components.

const BASE_URL = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { useAuthStore } = await import('./stores/authStore');
  const token = useAuthStore.getState().token;

  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(options?.headers as Record<string, string> | undefined),
    },
    ...options,
  });

  if (res.status === 401) {
    const { useAuthStore: store } = await import('./stores/authStore');
    store.getState().logout();
    window.location.href = '/dashboard/login';
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }

  if (res.status === 402) {
    throw Object.assign(new Error('Insufficient credits'), { status: 402 });
  }

  if (res.status === 403) {
    throw Object.assign(new Error('Pro plan required'), { status: 403 });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(text), { status: res.status });
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Legitimacy analyzer ──────────────────────────────────────────────────────
// POST /api/legitimacy/analyze  { project_url, model? }
// GET  /api/legitimacy/jobs/{job_id}

export interface LegitimacyAnalyzeRequest {
  project_url: string;
  model?: string;
}

export interface LegitimacyAnalyzeResponse {
  job_id: string;
  cached: boolean;
  report: string | null;        // markdown string (set when cached=true)
  evidence: Record<string, unknown> | null;
  conversation_id: string | null;
}

export interface LegitimacyJobStatusResponse {
  status: string;               // queued | collecting | verifying | scoring | generating | done | failed
  phase_progress: number;       // 0-100
  report: string | null;        // markdown (set when status=done)
  evidence: Record<string, unknown> | null;
  error: string | null;
  error_code: string | null;
  conversation_id: string | null;
}

export function legitimacyAnalyze(
  projectUrl: string,
  model?: string
): Promise<LegitimacyAnalyzeResponse> {
  return request<LegitimacyAnalyzeResponse>('/api/legitimacy/analyze', {
    method: 'POST',
    body: JSON.stringify({ project_url: projectUrl, model }),
  });
}

export function legitimacyGetJob(jobId: string): Promise<LegitimacyJobStatusResponse> {
  return request<LegitimacyJobStatusResponse>(`/api/legitimacy/jobs/${jobId}`);
}

// ─── GitHub analyzer ──────────────────────────────────────────────────────────
// POST /api/github-agent/analyze  { repo_url, model_id? }
// GET  /api/github-agent/jobs/{job_id}

export interface GitHubAnalyzeRequest {
  repo_url: string;
  model_id?: string;
}

export interface GitHubAnalyzeResponse {
  job_id: string;
  cached: boolean;
  report: GitHubReport | null;
  evidence: Record<string, unknown> | null;
  conversation_id: string | null;
}

export interface GitHubJobStatusResponse {
  status: string;               // queued | collecting | reading_code | analyzing | generating | done | failed
  phase_progress: number;       // 0-100
  report: GitHubReport | null;
  evidence: Record<string, unknown> | null;
  error: string | null;
  error_code: string | null;
}

// Mirrors GitHubReport from GitHubReportCard.tsx
export interface GitHubReport {
  verdict: string;              // QUALITY_PROJECT | SOLID_OK | LOW_EFFORT | AI_SLOP | ABANDONED | SUSPICIOUS
  confidence: string;           // high | medium | low
  what_it_is: string;
  code_quality: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    illogical_places: string[];
  };
  ai_slop: {
    readme_score: number;
    code_score: number;
    signals: string[];
  };
  security: {
    red_flags: string[];
    missing: string[];
  };
  activity: {
    health: string;             // active | slowing | dormant | abandoned
    last_commit_days_ago: number;
    bus_factor: number;
    notes: string[];
  };
  bottom_line: string;
  verify_yourself: Array<{ label: string; url: string }>;
  data_gaps: string[];
}

export function githubAnalyze(
  repoUrl: string,
  modelId?: string
): Promise<GitHubAnalyzeResponse> {
  return request<GitHubAnalyzeResponse>('/api/github-agent/analyze', {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl, model_id: modelId }),
  });
}

export function githubGetJob(jobId: string): Promise<GitHubJobStatusResponse> {
  return request<GitHubJobStatusResponse>(`/api/github-agent/jobs/${jobId}`);
}

// ─── Docs analyzer ──────────────────────────────────────────────────────────────
// POST /api/docs-agent/analyze  { url, model? }
// GET  /api/docs-agent/jobs/{job_id}
// NOTE: this is a PRO-gated agent - analyze can throw 402/403.

export interface DocsAnalyzeResponse {
  job_id: string;
  cached: boolean;
  report: DocsReport | null;
  conversation_id: string | null;
}

export interface DocsJobStatusResponse {
  status: string;               // queued | crawling | collecting | analyzing | scoring | generating | done | failed
  phase_progress: number;       // 0-100
  report: DocsReport | null;
  evidence: Record<string, unknown> | null;
  error: string | null;
  error_code: string | null;
}

// Mirrors the DocsAgentReport dict the backend returns (camelCase keys).
export interface DocsReport {
  url: string;
  tldr: string;
  summary: string;
  keyBenefits: string[];
  socials: {
    x?: string;
    telegram?: string;
    discord?: string;
    github?: string;
    website?: string;
  };
  slopScore: number;            // 0-100
  slopReasons: string[];
  techStack: string[];
  targetAudience: string;
  redFlags: string[];
  framework: 'gitbook' | 'mintlify' | 'docusaurus' | 'generic';
}

export function docsAnalyze(url: string, model?: string): Promise<DocsAnalyzeResponse> {
  return request<DocsAnalyzeResponse>('/api/docs-agent/analyze', {
    method: 'POST',
    body: JSON.stringify({ url, model }),
  });
}

export function docsGetJob(jobId: string): Promise<DocsJobStatusResponse> {
  return request<DocsJobStatusResponse>(`/api/docs-agent/jobs/${jobId}`);
}

// ─── Wallet analyzer ──────────────────────────────────────────────────────────
// POST /api/wallet/analyze  { address, chain, model? }
// GET  /api/wallet/jobs/{job_id}

// 'auto' lets the backend detect which chain(s) the address is active on.
export type WalletChain = 'auto' | 'ethereum' | 'base';

export interface WalletAnalyzeRequest {
  address: string;
  chain?: WalletChain; // defaults to 'auto' server-side
  model?: string;
}

export interface WalletAnalyzeResponse {
  job_id: string;
  cached: boolean;
  report: string | null;        // markdown string (set when cached=true)
  evidence: Record<string, unknown> | null;
  conversation_id: string | null;
}

export interface WalletJobStatusResponse {
  status: string;               // queued | collecting | verifying | scoring | generating | done | failed
  phase_progress: number;       // 0-100
  report: string | null;        // markdown (set when status=done)
  evidence: Record<string, unknown> | null;
  error: string | null;
  error_code: string | null;
  conversation_id: string | null;
}

export function walletAnalyze(
  address: string,
  chain: WalletChain,
  model?: string
): Promise<WalletAnalyzeResponse> {
  return request<WalletAnalyzeResponse>('/api/wallet/analyze', {
    method: 'POST',
    body: JSON.stringify({ address, chain, model }),
  });
}

export function walletGetJob(jobId: string): Promise<WalletJobStatusResponse> {
  return request<WalletJobStatusResponse>(`/api/wallet/jobs/${jobId}`);
}
