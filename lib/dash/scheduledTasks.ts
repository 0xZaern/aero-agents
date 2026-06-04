// Typed API wrappers for /api/scheduled-tasks
// All calls require JWT + Pro (handled by the shared request() utility in lib/api.ts).

import type {
  ScheduledTask,
  ScheduledRun,
  SchedulerCapabilities,
  ScheduleDraft,
  PatchScheduledTaskBody,
  PreviewResult,
  CostEstimateResult,
  PresetDefinition,
  DryRunResult,
} from './scheduler';

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

// GET /api/scheduled-tasks
export function listTasks(): Promise<ScheduledTask[]> {
  return request<ScheduledTask[]>('/api/scheduled-tasks');
}

// POST /api/scheduled-tasks - creates task + dedicated conversation
export function createTask(draft: ScheduleDraft): Promise<ScheduledTask> {
  return request<ScheduledTask>('/api/scheduled-tasks', {
    method: 'POST',
    body: JSON.stringify(draft),
  });
}

// GET /api/scheduled-tasks/:id
export function getTask(id: string): Promise<ScheduledTask> {
  return request<ScheduledTask>(`/api/scheduled-tasks/${id}`);
}

// PATCH /api/scheduled-tasks/:id
export function patchTask(
  id: string,
  body: PatchScheduledTaskBody
): Promise<ScheduledTask> {
  return request<ScheduledTask>(`/api/scheduled-tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// DELETE /api/scheduled-tasks/:id
export function deleteTask(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/scheduled-tasks/${id}`, {
    method: 'DELETE',
  });
}

// POST /api/scheduled-tasks/:id/run-now
export function runNow(id: string): Promise<ScheduledRun> {
  return request<ScheduledRun>(`/api/scheduled-tasks/${id}/run-now`, {
    method: 'POST',
  });
}

// POST /api/scheduled-tasks/preview - synchronous one-off, does not persist
export function previewTask(draft: ScheduleDraft): Promise<PreviewResult> {
  return request<PreviewResult>('/api/scheduled-tasks/preview', {
    method: 'POST',
    body: JSON.stringify(draft),
  });
}

// GET /api/scheduled-tasks/:id/runs?limit=20
export function listRuns(id: string, limit = 20): Promise<ScheduledRun[]> {
  return request<ScheduledRun[]>(
    `/api/scheduled-tasks/${id}/runs?limit=${limit}`
  );
}

// GET /api/scheduled-tasks/capabilities
export function getCapabilities(): Promise<SchedulerCapabilities> {
  return request<SchedulerCapabilities>('/api/scheduled-tasks/capabilities');
}

// GET /api/scheduled-tasks/:id/cost-estimate
export function getCostEstimate(id: string): Promise<CostEstimateResult> {
  return request<CostEstimateResult>(`/api/scheduled-tasks/${id}/cost-estimate`);
}

// GET /api/scheduled-tasks/presets
export function getPresets(): Promise<PresetDefinition[]> {
  return request<PresetDefinition[]>('/api/scheduled-tasks/presets');
}

// POST /api/scheduled-tasks/from-preset/:preset_id
export interface FromPresetOverrides {
  title?: string;
  prompt_template?: string;
  time_of_day?: string;
  frequency?: 'hourly' | 'daily' | 'weekly';
  day_of_week?: number;
  timezone?: string;
  deliver_chat?: boolean;
  deliver_telegram?: boolean;
  model_id?: string;
}
export function createFromPreset(
  presetId: string,
  config: Record<string, unknown>,
  overrides?: FromPresetOverrides
): Promise<ScheduledTask> {
  return request<ScheduledTask>(`/api/scheduled-tasks/from-preset/${presetId}`, {
    method: 'POST',
    body: JSON.stringify({ config, overrides: overrides ?? {} }),
  });
}

// POST /api/scheduled-tasks/dry-run (synchronous preview, does not persist)
export function dryRun(draft: ScheduleDraft): Promise<DryRunResult> {
  return request<DryRunResult>('/api/scheduled-tasks/dry-run', {
    method: 'POST',
    body: JSON.stringify(draft),
  });
}
