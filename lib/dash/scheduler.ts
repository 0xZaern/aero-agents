// Scheduler feature types - matches SCHEDULER_CONTRACT.md exactly

export interface ScheduleTimeConfig {
  mode: 'time';
  frequency: 'hourly' | 'daily' | 'weekly';
  time_of_day?: string; // "HH:MM", required for daily/weekly
  day_of_week?: number | number[]; // 0=Mon. Single int OR list for multi-day weekly
  timezone: string; // IANA tz, e.g. "Europe/Vilnius"
}

export interface ScheduleWatchConfig {
  mode: 'watch';
  source_type: 'twitter' | 'rss' | 'url_diff';
  source_ref: string; // "@handle" | RSS URL | page URL
  poll_interval_minutes: number; // min 60
  filter?: {
    keywords?: string[];
    exclude_replies?: boolean;
    exclude_retweets?: boolean;
  };
}

export type ScheduleConfig = ScheduleTimeConfig | ScheduleWatchConfig;

export interface ScheduleDraft {
  kind: 'schedule_draft';
  title: string;
  schedule: ScheduleConfig;
  prompt_template: string;
  deliver_telegram: boolean;
  deliver_chat: boolean;
  estimated_cost_per_run_usd: number;
  /** Model the Scheduler agent recommends for this task. null = use preset default. */
  recommended_model_id?: string | null;
  /** Model override chosen by user before activating. null = use preset default. */
  model_id?: string | null;
  /** Daily cost cap set by user before activating. undefined = no cap. */
  daily_cost_cap_usd?: number;
}

export type ScheduledTaskStatus = 'active' | 'paused' | 'error';

// New status values added for retry and cost-cap logic
export type ScheduledRunStatusExtended =
  | 'running'
  | 'success'
  | 'failed'
  | 'failed_retrying'
  | 'skipped_cost_cap'
  | 'skipped_no_credit'
  | 'skipped_no_new_items';
export type PauseReason = 'no_credit' | 'repeated_failure' | 'user' | null;

export interface ScheduledTask {
  id: string;
  user_id: string;
  conversation_id: string;
  agent_id: string | null;
  title: string;
  schedule: ScheduleConfig;
  prompt_template: string;
  deliver_telegram: boolean;
  deliver_chat: boolean;
  /** Model override for this task. null = use Scheduler preset default. */
  model_id: string | null;
  status: ScheduledTaskStatus;
  /** How many consecutive failures before task is auto-paused. */
  retry_count?: number;
  /** Daily spend cap in USD. null = no cap. */
  daily_cost_cap_usd?: number | null;
  pause_reason: PauseReason;
  consecutive_failures: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  quiet_hours_start?: number | null;
  quiet_hours_end?: number | null;
  cooldown_minutes?: number | null;
}

export type ScheduledRunStatus =
  | 'running'
  | 'success'
  | 'failed'
  | 'failed_retrying'
  | 'skipped_cost_cap'
  | 'skipped_no_credit'
  | 'skipped_no_new_items';

export interface ScheduledRun {
  id: string;
  task_id: string;
  started_at: string;
  finished_at: string | null;
  status: ScheduledRunStatus;
  output_message_id: string | null;
  output_text?: string | null;
  cost_usd: number;
  error_message: string | null;
}

export interface SchedulerCapabilities {
  telegram_delivery: boolean;
  twitter_source: boolean;
  rss_source: boolean;
  url_diff_source: boolean;
}

export interface PatchScheduledTaskBody {
  title?: string;
  schedule?: ScheduleConfig;
  prompt_template?: string;
  deliver_telegram?: boolean;
  deliver_chat?: boolean;
  status?: ScheduledTaskStatus;
  /** Model override. Pass null to clear the override and revert to preset default. */
  model_id?: string | null;
  /**
   * Daily cost cap in USD.
   * - Pass a number to set/update the cap.
   * - Pass null explicitly to clear an existing cap.
   * - Omit (undefined) to leave the current value unchanged.
   */
  daily_cost_cap_usd?: number | null;
  quiet_hours_start?: number | null;
  quiet_hours_end?: number | null;
  cooldown_minutes?: number | null;
}

export interface CostEstimateResult {
  estimated_daily_cost_usd: number;
}

export interface PreviewResult {
  output_text: string;
  cost_usd: number;
}

// ---------------------------------------------------------------------------
// New types for presets, dry-run, and quiet hours / cooldown
// ---------------------------------------------------------------------------

export interface PresetRequiredConfig {
  key: string;
  label: string;
  default?: string | number;
  type?: 'text' | 'number' | 'city';
}

export interface PresetDefinition {
  id: string;
  title: string;
  description: string;
  category: 'news' | 'crypto' | 'weather' | 'tech' | 'personal';
  icon: string; // emoji or lucide icon name
  schedule: ScheduleTimeConfig | ScheduleWatchConfig;
  prompt_template: string;
  recommended_model_id: string;
  deliver_chat: boolean;
  deliver_telegram: boolean;
  requires_config: PresetRequiredConfig[];
  estimated_cost_per_run_usd: number;
}

export interface DryRunFetchedSource {
  url: string;
  kind: string;
  chars: number;
}

export interface DryRunResult {
  output: string;
  fetched_sources: DryRunFetchedSource[];
  cost_usd: number;
  duration_ms: number;
}

// Added new optional fields to ScheduledTask (also update ScheduledTask above)
// Augmenting via module augmentation pattern is not possible - we patch the
// interface directly below by re-exporting an extended shape.
// NOTE: quiet_hours_start / quiet_hours_end are 0-23 hour integers (local tz).
export interface ScheduledTaskExtendedFields {
  quiet_hours_start?: number | null;
  quiet_hours_end?: number | null;
  cooldown_minutes?: number | null;
}
