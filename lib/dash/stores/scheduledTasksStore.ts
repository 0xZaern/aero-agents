import { create } from 'zustand';
import type {
  ScheduledTask,
  ScheduledRun,
  SchedulerCapabilities,
  ScheduleDraft,
  PatchScheduledTaskBody,
  PresetDefinition,
  DryRunResult,
} from '../scheduler';
import * as scheduledTasksApi from '../scheduledTasks';
import * as api from '../api';
import { useChatStore } from './chatStore';

// Persistent unread tracking - per-task last-seen successful run id.
// When the latest successful run id differs from the saved one, the row
// shows an unread dot until the user opens that task's conversation.
const LAST_SEEN_KEY = 'conductor:scheduledTasks:lastSeen';

function loadLastSeen(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveLastSeen(map: Record<string, string>) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode - ignore */
  }
}

interface ScheduledTasksState {
  tasks: ScheduledTask[];
  runs: Record<string, ScheduledRun[]>; // keyed by task id
  capabilities: SchedulerCapabilities | null;
  isLoading: boolean;
  error: string | null;
  runningTaskIds: Set<string>;
  lastSeenRunIds: Record<string, string>;

  // Presets cache
  presets: PresetDefinition[];
  presetsLoading: boolean;

  // Actions
  fetchAll: () => Promise<void>;
  fetchCapabilities: () => Promise<void>;
  create: (draft: ScheduleDraft) => Promise<ScheduledTask>;
  patch: (id: string, body: PatchScheduledTaskBody) => Promise<ScheduledTask>;
  remove: (id: string) => Promise<void>;
  runNow: (id: string) => Promise<ScheduledRun>;
  fetchRuns: (id: string, limit?: number) => Promise<void>;
  preview: (draft: ScheduleDraft) => Promise<{ output_text: string; cost_usd: number }>;
  dryRun: (draft: ScheduleDraft) => Promise<DryRunResult>;
  fetchPresets: () => Promise<void>;
  createFromPreset: (
    presetId: string,
    config: Record<string, unknown>,
    overrides?: import('../scheduledTasks').FromPresetOverrides
  ) => Promise<ScheduledTask>;
  markTaskDoneRunning: (id: string) => void;
  markTaskSeen: (id: string) => void;
  isTaskUnread: (id: string) => boolean;

  // Optimistic helpers
  upsertTask: (task: ScheduledTask) => void;
  removeTask: (id: string) => void;
}

export const useScheduledTasksStore = create<ScheduledTasksState>((set, get) => ({
  tasks: [],
  runs: {},
  capabilities: null,
  isLoading: false,
  error: null,
  runningTaskIds: new Set<string>(),
  lastSeenRunIds: loadLastSeen(),
  presets: [],
  presetsLoading: false,

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await scheduledTasksApi.listTasks();
      set({ tasks, isLoading: false });
      // Prefetch last run for each task so the UI can show last-run status
      // (success / failed / skipped_no_new_items) without requiring the user
      // to open the task. Also re-hydrates the runningTaskIds set so a page
      // reload mid-run still shows the "running..." indicator.
      await Promise.all(
        tasks.map(async (t) => {
          try {
            const runs = await scheduledTasksApi.listRuns(t.id, 1);
            set((state) => {
              const nextRunning = new Set(state.runningTaskIds);
              if (runs[0]?.status === 'running') nextRunning.add(t.id);
              else nextRunning.delete(t.id);
              return {
                runs: { ...state.runs, [t.id]: runs },
                runningTaskIds: nextRunning,
              };
            });
          } catch {
            /* ignore - leaves old value or undefined */
          }
        })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load scheduled tasks';
      set({ isLoading: false, error: msg });
    }
  },

  fetchCapabilities: async () => {
    try {
      const capabilities = await scheduledTasksApi.getCapabilities();
      set({ capabilities });
    } catch {
      // Non-fatal - fall back to disabling optional features
      set({
        capabilities: {
          telegram_delivery: false,
          twitter_source: false,
          rss_source: true,
          url_diff_source: true,
        },
      });
    }
  },

  create: async (draft: ScheduleDraft) => {
    const task = await scheduledTasksApi.createTask(draft);
    set((state) => ({
      tasks: [task, ...state.tasks.filter((t) => t.id !== task.id)],
    }));
    return task;
  },

  patch: async (id: string, body: PatchScheduledTaskBody) => {
    const updated = await scheduledTasksApi.patchTask(id, body);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
    }));
    return updated;
  },

  remove: async (id: string) => {
    // Optimistic remove
    const prev = get().tasks.find((t) => t.id === id);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    try {
      await scheduledTasksApi.deleteTask(id);
    } catch {
      // Roll back on failure
      if (prev) {
        set((state) => ({ tasks: [prev, ...state.tasks] }));
      }
      throw new Error('Failed to delete task');
    }
  },

  runNow: async (id: string) => {
    // Idempotency guard - ignore re-entry while a run for this task is
    // already in flight. Prevents double-click and React StrictMode's
    // double-invoke from kicking off two parallel runs (the second one
    // becomes a permanent "running" ghost row).
    if (get().runningTaskIds.has(id)) {
      const existing = get().runs[id]?.[0];
      if (existing) return existing;
      // Fall through only if somehow flag set but no run known
    }

    // Mark task as running immediately (optimistic)
    set((state) => {
      const next = new Set(state.runningTaskIds);
      next.add(id);
      return { runningTaskIds: next };
    });

    let run: ScheduledRun;
    try {
      run = await scheduledTasksApi.runNow(id);
      set((state) => ({
        runs: {
          ...state.runs,
          [id]: [run, ...(state.runs[id] ?? [])],
        },
      }));
    } catch (err) {
      // Remove from running set on API failure
      set((state) => {
        const next = new Set(state.runningTaskIds);
        next.delete(id);
        return { runningTaskIds: next };
      });
      throw err;
    }

    // Background poll: check run status until it leaves 'running'.
    // Scheduler runs can take several minutes (web_search + url_reader
    // loops, LLM with large context, retries) - capping at 30s made the
    // UI lie ("done!") while the backend was still working.
    // Cap at 10 min as a safety net against truly stuck runs.
    // Backoff: 2s for first 30s, then 5s for the rest.
    const startedAt = Date.now();
    const TIMEOUT_MS = 600_000; // 10 min

    const poll = async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed > TIMEOUT_MS) {
        get().markTaskDoneRunning(id);
        return;
      }
      try {
        await get().fetchRuns(id, 1);
        const latestRuns = get().runs[id];
        const latest = latestRuns?.[0];
        if (latest && latest.status !== 'running') {
          get().markTaskDoneRunning(id);

          // Refresh messages of the task's conversation so the new run's
          // output appears immediately - covers the case where the user
          // isn't subscribed to the live WebSocket (closed tab, navigated
          // away, or re-opened the conv after polling completed).
          try {
            const task = get().tasks.find((t) => t.id === id);
            const convId = task?.conversation_id;
            if (convId) {
              const currentConv = useChatStore.getState().currentConversationId;
              if (currentConv === convId) {
                const msgs = await api.getConversationMessages(convId);
                useChatStore.getState().setMessages(msgs);
              }
            }
          } catch {
            /* non-fatal - next page load will pick it up */
          }
          return;
        }
      } catch {
        // ignore poll errors - retry on next tick
      }
      const nextInterval = elapsed < 30_000 ? 2_000 : 5_000;
      setTimeout(poll, nextInterval);
    };

    setTimeout(poll, 2_000);

    return run;
  },

  fetchRuns: async (id: string, limit = 20) => {
    const runs = await scheduledTasksApi.listRuns(id, limit);
    set((state) => ({ runs: { ...state.runs, [id]: runs } }));
  },

  preview: async (draft: ScheduleDraft) => {
    return scheduledTasksApi.previewTask(draft);
  },

  dryRun: async (draft: ScheduleDraft) => {
    return scheduledTasksApi.dryRun(draft);
  },

  fetchPresets: async () => {
    if (get().presetsLoading) return;
    set({ presetsLoading: true });
    try {
      const presets = await scheduledTasksApi.getPresets();
      set({ presets, presetsLoading: false });
    } catch {
      set({ presetsLoading: false });
    }
  },

  createFromPreset: async (presetId, config, overrides) => {
    const task = await scheduledTasksApi.createFromPreset(presetId, config, overrides);
    set((state) => ({
      tasks: [task, ...state.tasks.filter((t) => t.id !== task.id)],
    }));
    return task;
  },

  markTaskDoneRunning: (id: string) => {
    set((state) => {
      const next = new Set(state.runningTaskIds);
      next.delete(id);
      return { runningTaskIds: next };
    });
  },

  markTaskSeen: (id: string) => {
    const latest = get().runs[id]?.[0];
    if (!latest) return;
    set((state) => {
      // Only update if it changed - keeps zustand subscribers stable.
      if (state.lastSeenRunIds[id] === latest.id) return state;
      const next = { ...state.lastSeenRunIds, [id]: latest.id };
      saveLastSeen(next);
      return { lastSeenRunIds: next };
    });
  },

  isTaskUnread: (id: string) => {
    const latest = get().runs[id]?.[0];
    if (!latest) return false;
    // Only successful deliveries count as "new messages worth seeing".
    if (latest.status !== 'success') return false;
    return get().lastSeenRunIds[id] !== latest.id;
  },

  upsertTask: (task: ScheduledTask) => {
    set((state) => {
      const exists = state.tasks.some((t) => t.id === task.id);
      if (exists) {
        return { tasks: state.tasks.map((t) => (t.id === task.id ? task : t)) };
      }
      return { tasks: [task, ...state.tasks] };
    });
  },

  removeTask: (id: string) => {
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },
}));
