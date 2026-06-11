import type {
  Agent,
  AgentTestResponse,
  AttachmentOut,
  Conversation,
  CostSummary,
  Crew,
  CrewExecution,
  FileOverride,
  Message,
  Model,
} from './types';

// Call the backend DIRECTLY when NEXT_PUBLIC_API_URL is set (e.g. the Railway
// URL) - same origin the WebSocket uses. This skips the Vercel rewrite proxy
// hop that otherwise sits on every REST request (browser → Vercel → Railway).
// When unset (local dev), fall back to a relative base so next.config rewrites
// proxy /api/* to localhost:8000.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function makeApiError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.name = 'ApiError';
  err.status = status;
  return err;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Lazily import authStore to avoid circular deps at module load time
  const { useAuthStore } = await import('./stores/authStore');
  const token = useAuthStore.getState().token;

  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options?.headers,
    },
    ...options,
  });

  // 401 - token expired or invalid; clear auth and redirect to login
  if (res.status === 401) {
    const { useAuthStore: store } = await import('./stores/authStore');
    store.getState().logout();
    window.location.href = '/dashboard/login';
    throw makeApiError(401, 'Unauthorized');
  }

  // 402 - insufficient credits
  if (res.status === 402) {
    const { useToastStore } = await import('./stores/toastStore');
    useToastStore.getState().addToast('Insufficient credits', 'error');
    throw makeApiError(402, 'Insufficient credits');
  }

  // 403 - Pro plan required
  if (res.status === 403) {
    const { useToastStore } = await import('./stores/toastStore');
    useToastStore.getState().addToast('Pro plan required for this feature', 'error');
    throw makeApiError(403, 'Pro plan required');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw makeApiError(res.status, text);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

/* ─── Auth ─── */
export const getNonce = (address: string) =>
  request<{ nonce: string }>(`/api/auth/nonce?address=${address}`);

export const verifySignature = (message: string, signature: string) =>
  request<{ token: string; user: { id: string; walletAddress: string; credits: number; plan: string; proExpiresAt?: string | null; themeOverrides?: string | null } }>(
    '/api/auth/verify',
    {
      method: 'POST',
      body: JSON.stringify({ message, signature }),
    }
  );

export const connectWallet = (address: string) =>
  request<{ token: string; user: { id: string; walletAddress: string; credits: number; plan: string; proExpiresAt?: string | null; themeOverrides?: string | null } }>(
    '/api/auth/connect',
    {
      method: 'POST',
      body: JSON.stringify({ address }),
    }
  );

export const getMe = () =>
  request<{ id: string; walletAddress: string; credits: number; plan: string; proExpiresAt?: string | null; avatarVariant?: string | null; themeOverrides?: string | null }>('/api/auth/me');

export const updateAvatar = (variant: string) =>
  request<{ avatarVariant: string }>('/api/auth/avatar', {
    method: 'PATCH',
    body: JSON.stringify({ variant }),
  });

// Persist the user's dashboard theme overrides (per wallet, syncs across devices).
export const saveTheme = (overrides: Record<string, string> | null) =>
  request<{ themeOverrides: string | null }>('/api/auth/theme', {
    method: 'POST',
    body: JSON.stringify({ overrides }),
  });

/* ─── Models ─── */
export const getModels = () => request<Model[]>('/api/models');

export const listAllModels = () => request<Model[]>('/api/models/all');

/* ─── Conversations ─── */
export const getConversations = () =>
  request<Conversation[]>('/api/conversations');

export const createConversation = (data: {
  modelId: string;
  title?: string;
  agentId?: string;
  systemPrompt?: string;
}) =>
  request<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getConversation = (id: string) =>
  request<Conversation>(`/api/conversations/${id}`);

export const updateConversation = (
  id: string,
  data: Partial<Conversation>
) =>
  request<Conversation>(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteConversation = (id: string) =>
  request<void>(`/api/conversations/${id}`, { method: 'DELETE' });

export const getConversationMessages = async (id: string): Promise<Message[]> => {
  const data = await request<Conversation & { messages: Message[] }>(`/api/conversations/${id}`);
  return data.messages ?? [];
};

/* ─── Agents ─── */
export const getAgents = (tab?: 'presets' | 'my' | 'community') => {
  const qs = tab ? `?tab=${tab}` : '';
  return request<Agent[]>(`/api/agents${qs}`);
};

export const createAgent = (data: Omit<Agent, 'id' | 'isPreset'>) =>
  request<Agent>('/api/agents', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateAgent = (id: string, data: Partial<Agent>) =>
  request<Agent>(`/api/agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteAgent = (id: string) =>
  request<void>(`/api/agents/${id}`, { method: 'DELETE' });

export const deleteAgentPermanent = (id: string) =>
  request<void>(`/api/agents/${id}/permanent`, { method: 'DELETE' });

export const publishAgent = (id: string, publicDescription: string) =>
  request<Agent>(`/api/agents/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ publicDescription }),
  });

export const unpublishAgent = (id: string) =>
  request<void>(`/api/agents/${id}/unpublish`, { method: 'POST', body: JSON.stringify({}) });

export const cloneAgent = (id: string) =>
  request<Agent>(`/api/agents/${id}/clone`, { method: 'POST', body: JSON.stringify({}) });

export const reportAgent = (id: string, reason?: string) =>
  request<void>(`/api/agents/${id}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

export const testAgent = (agentId: string, message: string) =>
  request<AgentTestResponse>(`/api/agents/${agentId}/test`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });

export const improveBackstory = (draft: string) =>
  request<{ improved: string }>('/api/agents/improve-backstory', {
    method: 'POST',
    body: JSON.stringify({ draft }),
  });

export const createAgentChat = (agentId: string, title?: string) =>
  request<Conversation>(`/api/agents/${agentId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });

export const createCrewChat = (crewId: string, title?: string) =>
  request<Conversation>(`/api/crews/${crewId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });

/* ─── Crews ─── */
export const getCrews = () => request<Crew[]>('/api/crews');

export const createCrew = (data: Omit<Crew, 'id' | 'isPreset'>) =>
  request<Crew>('/api/crews', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateCrew = (id: string, data: Partial<Crew>) =>
  request<Crew>(`/api/crews/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteCrew = (id: string) =>
  request<void>(`/api/crews/${id}`, { method: 'DELETE' });

/* ─── Crew Executions ─── */
export const runCrew = (crewId: string, taskDescription: string) =>
  request<CrewExecution>(`/api/crews/${crewId}/run`, {
    method: 'POST',
    body: JSON.stringify({ taskDescription }),
  });

export const cancelExecution = (executionId: string) =>
  request<void>(`/api/crews/executions/${executionId}/cancel`, {
    method: 'POST',
  });

export const listExecutions = () =>
  request<CrewExecution[]>('/api/crews/executions');

export const getExecution = (id: string) =>
  request<CrewExecution>(`/api/crews/executions/${id}`);

/* ─── File Overrides ─── */

/** Map backend snake_case keys to camelCase for FileOverride */
function mapFileOverride(raw: Record<string, unknown>): FileOverride {
  return {
    id: raw.id as string,
    conversationId: (raw.conversation_id ?? raw.conversationId) as string,
    filePath: (raw.file_path ?? raw.filePath) as string,
    content: raw.content as string,
    language: raw.language as string,
    source: raw.source as FileOverride['source'],
    createdAt: (raw.created_at ?? raw.createdAt) as string,
    updatedAt: (raw.updated_at ?? raw.updatedAt) as string,
  };
}

export async function getFileOverrides(conversationId: string): Promise<FileOverride[]> {
  const raw = await request<Record<string, unknown>[]>(
    `/api/conversations/${conversationId}/file-overrides`
  );
  return raw.map(mapFileOverride);
}

export async function createFileOverride(
  conversationId: string,
  payload: { filePath: string; content: string; language: string; source: FileOverride['source'] }
): Promise<FileOverride> {
  const raw = await request<Record<string, unknown>>(
    `/api/conversations/${conversationId}/file-overrides`,
    {
      method: 'POST',
      body: JSON.stringify({
        file_path: payload.filePath,
        content: payload.content,
        language: payload.language,
        source: payload.source,
      }),
    }
  );
  return mapFileOverride(raw);
}

export async function updateFileOverride(
  overrideId: string,
  payload: { content?: string; source?: FileOverride['source'] }
): Promise<FileOverride> {
  const raw = await request<Record<string, unknown>>(
    `/api/file-overrides/${overrideId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
  return mapFileOverride(raw);
}

export async function deleteFileOverride(overrideId: string): Promise<void> {
  await request<void>(`/api/file-overrides/${overrideId}`, { method: 'DELETE' });
}

/* ─── Costs ─── */
export const getCostSummary = () =>
  request<CostSummary>('/api/costs/summary');

export const getDailyCosts = () =>
  request<{ date: string; cost: number }[]>('/api/costs/daily');

/* ─── Payments ─── */

export interface Payment {
  id: string;
  txHash: string;
  paymentType: 'credits' | 'pro';
  amountUsdc: number;
  creditsAdded: number;
  createdAt: string;
}

export interface PaymentVerifyResponse {
  success: boolean;
  paymentType: string;
  amount: number;
  credits: number;
  plan: string;
  proExpiresAt: string | null;
}

export interface PaymentConfig {
  treasuryWallet: string;
  usdcContract: string;
  chainId: number;
  proPrice: number;
}

export const verifyPayment = (txHash: string, paymentType: 'credits' | 'pro') =>
  request<PaymentVerifyResponse>('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify({ tx_hash: txHash, payment_type: paymentType }),
  });

export const getPaymentHistory = () =>
  request<Payment[]>('/api/payments/history');

export const getPaymentConfig = () =>
  request<PaymentConfig>('/api/payments/config');

/* ─── Developer API (keys, VVV packs, usage) ─── */

export interface ApiKey {
  id: string;
  prefix: string;
  label: string;
  revoked: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiKeyCreated {
  id: string;
  key: string;        // raw sk_aero_... - shown ONCE
  prefix: string;
  label: string;
  createdAt: string;
}

export interface VvvPack {
  id: string;
  label: string;
  vvv: number;
  credits: number;
}

export interface ApiConfig {
  treasuryWallet: string;
  veniceContract: string;
  veniceDecimals: number;
  chainId: number;
  packs: VvvPack[];
  endpoints: number;  // live /v1 route count from the backend (auto-updates)
}

export interface VvvVerifyResponse {
  success: boolean;
  packId: string;
  vvvPaid: number;
  creditsAdded: number;
  credits: number;
}

export interface ApiUsageRow {
  id: string;
  endpoint: string;
  modelId: string | null;
  inputTokens: number;
  outputTokens: number;
  creditsSpent: number;
  statusCode: number;
  createdAt: string;
}

export interface ApiBalance {
  apiCredits: number;
}

export const getApiConfig = () => request<ApiConfig>('/api/dev/config');

export const getApiBalance = () => request<ApiBalance>('/api/dev/balance');

export const listApiKeys = () => request<ApiKey[]>('/api/dev/keys');

export const createApiKey = (label: string) =>
  request<ApiKeyCreated>('/api/dev/keys', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });

export const revokeApiKey = (id: string) =>
  request<{ success: boolean; id: string }>(`/api/dev/keys/${id}`, { method: 'DELETE' });

export const getApiUsage = () => request<ApiUsageRow[]>('/api/dev/usage');

export const verifyVvvPayment = (txHash: string, packId: string) =>
  request<VvvVerifyResponse>('/api/payments/verify-vvv', {
    method: 'POST',
    body: JSON.stringify({ tx_hash: txHash, pack_id: packId }),
  });

/* ─── Uploads ─── */
export async function uploadFile(file: File): Promise<AttachmentOut> {
  // Lazily import authStore to avoid circular deps at module load time
  const { useAuthStore } = await import('./stores/authStore');
  const token = useAuthStore.getState().token;

  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch(`${BASE_URL}/api/uploads`, {
    method: 'POST',
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    const { useAuthStore: store } = await import('./stores/authStore');
    store.getState().logout();
    window.location.href = '/dashboard/login';
    throw makeApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw makeApiError(res.status, text);
  }

  return res.json() as Promise<AttachmentOut>;
}

/* ─── Telegram ─── */
export const verifyTelegramCode = (code: string) =>
  request<{ success: boolean; telegram_id: number }>('/api/telegram/verify-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

export const unlinkTelegram = () =>
  request<{ success: boolean }>('/api/telegram/unlink', {
    method: 'DELETE',
  });

export const getTelegramStatus = () =>
  request<{ linked: boolean; telegram_id: number | null }>('/api/telegram/status');

/* ─── X-Agent Narratives ─── */

export interface XAgentNarrative {
  id: string;
  name: string;
  text: string;
  created_at: string;
}

export async function getXAgentNarratives(): Promise<XAgentNarrative[]> {
  return request<XAgentNarrative[]>('/api/xagent/narratives');
}

export async function saveXAgentNarrative(name: string, text: string): Promise<XAgentNarrative> {
  return request<XAgentNarrative>('/api/xagent/narratives', {
    method: 'POST',
    body: JSON.stringify({ name, text }),
  });
}

export async function deleteXAgentNarrative(id: string): Promise<void> {
  return request<void>(`/api/xagent/narratives/${id}`, { method: 'DELETE' });
}

/* ─── X-Agent ─── */
export async function resolveTwitterUrl(url: string): Promise<{
  text: string;
  author: string | null;
  handle: string | null;
  tweet_id: string | null;
}> {
  return request<{
    text: string;
    author: string | null;
    handle: string | null;
    tweet_id: string | null;
  }>('/api/xagent/resolve-tweet', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/* ─── X-Agent Keywords ─── */

export interface KeywordSuggestion {
  keyword: string;
  category: string;
  description: string;
  exampleSearch: string;
}

export async function suggestKeywords(narrative: string, modelId?: string): Promise<{ keywords: KeywordSuggestion[] }> {
  return request<{ keywords: KeywordSuggestion[] }>('/api/xagent/suggest-keywords', {
    method: 'POST',
    body: JSON.stringify({ narrative, model_id: modelId }),
  });
}

/* ─── X-Agent History ─── */

export interface XAgentHistoryEntry {
  id: string;
  tweet_text: string;
  reply_text: string;
  tone: string;
  char_count: number;
  used: boolean;
  created_at: string;
}

export async function saveXAgentHistory(entries: { tweet_text: string; reply_text: string; tone: string; char_count: number }[]): Promise<{ saved: number }> {
  return request<{ saved: number }>('/api/xagent/history', {
    method: 'POST',
    body: JSON.stringify({ entries }),
  });
}

export async function getXAgentHistory(limit?: number): Promise<XAgentHistoryEntry[]> {
  const qs = limit ? `?limit=${limit}` : '';
  return request<XAgentHistoryEntry[]>(`/api/xagent/history${qs}`);
}

export async function markXAgentHistoryUsed(historyId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/xagent/history/mark-used', {
    method: 'POST',
    body: JSON.stringify({ history_id: historyId }),
  });
}

export async function markXAgentHistoryUsedByText(
  replyText: string,
  tone?: string,
): Promise<{ success: boolean; matched: boolean }> {
  return request<{ success: boolean; matched: boolean }>(
    '/api/xagent/history/mark-used-by-text',
    {
      method: 'POST',
      body: JSON.stringify({ reply_text: replyText, tone }),
    },
  );
}

/* ─── Agent of the Week ─── */

export interface WeeklyAgentResponse {
  agent: import('./types').Agent | null;
  startedAt: string | null;
  endsAt: string | null;
}

export async function getWeeklyAgent(): Promise<WeeklyAgentResponse> {
  return request<WeeklyAgentResponse>('/api/agents/week');
}

/* ─── X-Agent Memory ─── */

export interface XAgentMemory {
  total_replies_generated: number;
  total_replies_used: number;
  top_tones: string[];
  avg_reply_length: number;
}

export async function getXAgentMemory(): Promise<XAgentMemory> {
  return request<XAgentMemory>('/api/xagent/memory');
}

/* ─── YouTube Agent ─── */

export interface YouTubeAnalyzeResponse {
  job_id: string;
  cached: boolean;
  report: YouTubeReport | null;
  evidence: YouTubeEvidence | null;
  conversation_id: string | null;
}

export interface YouTubeJobStatusResponse {
  status: 'pending' | 'running' | 'completed' | 'failed';
  phase_progress: Record<string, number>;
  report: YouTubeReport | null;
  evidence: YouTubeEvidence | null;
  error: string | null;
  error_code: string | null;
}

export interface YouTubeJobByConversationResponse {
  job_id: string;
  status: string;
  phase_progress: number;
}

export interface YouTubeReport {
  tldr: string;
  what_it_is_about: string;
  key_points: Array<{ point: string; why_matters: string; timestamp_seconds: number | null }>;
  causes_or_background: string[];
  solutions_or_takeaways: string[];
  quotes: Array<{ text: string; timestamp_seconds: number | null }>;
  chapters: Array<{ title: string; start_seconds: number }>;
  topics: string[];
  content_type: 'tutorial' | 'podcast' | 'lecture' | 'interview' | 'news' | 'review' | 'vlog' | 'other';
}

export interface YouTubeEvidence {
  video: {
    video_id: string;
    title: string;
    channel: string;
    duration_seconds: number;
    thumbnail_url: string;
    upload_date: string;
    url: string;
  };
  transcript_source: 'manual_captions' | 'auto_captions';
  language: string;
  pipeline_elapsed_seconds: number;
}

export async function youtubeAnalyze(
  videoUrl: string,
  modelId?: string
): Promise<YouTubeAnalyzeResponse> {
  return request<YouTubeAnalyzeResponse>('/api/youtube-agent/analyze', {
    method: 'POST',
    body: JSON.stringify({ video_url: videoUrl, model_id: modelId }),
  });
}

export async function youtubeGetJob(jobId: string): Promise<YouTubeJobStatusResponse> {
  return request<YouTubeJobStatusResponse>(`/api/youtube-agent/jobs/${jobId}`);
}

export async function youtubeGetJobByConversation(
  conversationId: string
): Promise<YouTubeJobByConversationResponse> {
  return request<YouTubeJobByConversationResponse>(
    `/api/youtube-agent/jobs/by-conversation/${conversationId}`
  );
}
