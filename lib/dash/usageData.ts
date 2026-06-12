/**
 * Usage & Activity mock data module.
 *
 * Typed to match the shape a real /api/usage endpoint would return.
 * Swap getUsageData() for a real fetch call when the backend is ready —
 * all consumer components reference only these types and that function.
 */

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export type AgentId =
  | 'researcher'
  | 'coder'
  | 'writer'
  | 'analyst'
  | 'scheduler'
  | 'reviewer';

export interface AgentMeta {
  id: AgentId;
  name: string;
  role: string;
}

/** One day's token and run snapshot, per agent. */
export interface DailyAgentUsage {
  date: string;           // ISO date "YYYY-MM-DD"
  agentId: AgentId;
  inputTokens: number;
  outputTokens: number;
  runs: number;
  costUsd: number;
}

/** Aggregate stats for one agent across the queried window. */
export interface AgentSummary {
  agentId: AgentId;
  name: string;
  role: string;
  totalRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  /** Cost share as a value 0-1 */
  costShare: number;
}

/** A single entry in the recent activity feed. */
export type ActivityKind =
  | 'run_complete'
  | 'run_failed'
  | 'run_started'
  | 'token_milestone';

export interface ActivityEntry {
  id: string;
  agentId: AgentId;
  agentName: string;
  kind: ActivityKind;
  description: string;
  /** Tokens consumed (null for non-run events). */
  tokens: number | null;
  /** Cost in USD (null for non-run events). */
  costUsd: number | null;
  timestamp: string; // ISO timestamp
}

/** Top-level shape returned by getUsageData(). */
export interface UsageData {
  /** Human-readable window label, e.g. "Last 7 days". */
  windowLabel: string;
  /** First date in the window (ISO). */
  from: string;
  /** Last date in the window (ISO). */
  to: string;
  /** All daily rows — consumers filter by agentId and date. */
  daily: DailyAgentUsage[];
  /** Pre-aggregated per-agent summaries for the window. */
  agents: AgentSummary[];
  /** Flat workspace-wide stats for the stat card row. */
  totals: {
    runs: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  /** Activity feed, newest-first. */
  activity: ActivityEntry[];
}

/* ─── Agent Registry ─────────────────────────────────────────────────────────── */

export const AGENT_META: Record<AgentId, AgentMeta> = {
  researcher: { id: 'researcher', name: 'Researcher', role: 'web search & synthesis' },
  coder:      { id: 'coder',      name: 'Coder',      role: 'code generation & review' },
  writer:     { id: 'writer',     name: 'Writer',      role: 'long-form content & copy' },
  analyst:    { id: 'analyst',    name: 'Analyst',     role: 'data analysis & reports' },
  scheduler:  { id: 'scheduler',  name: 'Scheduler',   role: 'task orchestration' },
  reviewer:   { id: 'reviewer',   name: 'Reviewer',    role: 'quality assurance' },
};

/* ─── Deterministic mock data ─────────────────────────────────────────────────
   All values are fixed — no Math.random() — so builds are deterministic and
   SSR/hydration produces matching output. Numbers are designed to look like
   realistic 30-day usage for a power user.
   ───────────────────────────────────────────────────────────────────────────── */

/** Generate ISO date strings going back `days` from 2026-06-12. */
function dates(days: number): string[] {
  const out: string[] = [];
  const base = new Date('2026-06-12T00:00:00Z');
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Deterministic "pseudo-random" using a simple LCG seeded from day-index + agent-index. */
function lcg(seed: number): number {
  return ((seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}

const AGENTS: AgentId[] = ['researcher', 'coder', 'writer', 'analyst', 'scheduler', 'reviewer'];

/** Cost-per-1k-tokens weighting per agent (reflecting model tier). */
const COST_WEIGHT: Record<AgentId, number> = {
  researcher: 0.003,
  coder:      0.004,
  writer:     0.002,
  analyst:    0.005,
  scheduler:  0.001,
  reviewer:   0.002,
};

/** Typical daily run count range per agent [min, max]. */
const RUN_RANGE: Record<AgentId, [number, number]> = {
  researcher: [3, 12],
  coder:      [5, 18],
  writer:     [2, 8],
  analyst:    [1, 6],
  scheduler:  [4, 14],
  reviewer:   [2, 9],
};

function buildDaily(allDates: string[]): DailyAgentUsage[] {
  const rows: DailyAgentUsage[] = [];
  allDates.forEach((date, di) => {
    AGENTS.forEach((agentId, ai) => {
      const seed1 = di * 7 + ai;
      const seed2 = di * 13 + ai * 5;
      const seed3 = di * 17 + ai * 3;
      const [rMin, rMax] = RUN_RANGE[agentId];
      const runs = Math.round(rMin + lcg(seed1) * (rMax - rMin));
      const inputTokens = Math.round(1200 + lcg(seed2) * 4800) * runs;
      const outputTokens = Math.round(400 + lcg(seed3) * 1600) * runs;
      const costUsd =
        (inputTokens / 1000) * COST_WEIGHT[agentId] +
        (outputTokens / 1000) * COST_WEIGHT[agentId] * 1.5;
      rows.push({ date, agentId, inputTokens, outputTokens, runs, costUsd });
    });
  });
  return rows;
}

function aggregateAgents(daily: DailyAgentUsage[]): AgentSummary[] {
  const map: Record<string, AgentSummary> = {};
  for (const row of daily) {
    if (!map[row.agentId]) {
      const meta = AGENT_META[row.agentId];
      map[row.agentId] = {
        agentId: row.agentId,
        name: meta.name,
        role: meta.role,
        totalRuns: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
        costShare: 0,
      };
    }
    map[row.agentId].totalRuns += row.runs;
    map[row.agentId].totalInputTokens += row.inputTokens;
    map[row.agentId].totalOutputTokens += row.outputTokens;
    map[row.agentId].totalCostUsd += row.costUsd;
  }
  const summaries = Object.values(map);
  const totalCost = summaries.reduce((s, a) => s + a.totalCostUsd, 0) || 1;
  summaries.forEach((s) => { s.costShare = s.totalCostUsd / totalCost; });
  return summaries.sort((a, b) => b.totalRuns - a.totalRuns);
}

const ACTIVITY_TEMPLATES: Array<{
  kind: ActivityKind;
  template: (agent: string) => string;
  hasTokens: boolean;
}> = [
  { kind: 'run_complete', template: (a) => `${a} completed a run successfully`, hasTokens: true },
  { kind: 'run_complete', template: (a) => `${a} finished processing request`, hasTokens: true },
  { kind: 'run_failed',   template: (a) => `${a} run failed — context limit exceeded`, hasTokens: false },
  { kind: 'run_started',  template: (a) => `${a} started a new run`, hasTokens: false },
  { kind: 'run_complete', template: (a) => `${a} synthesized report in 3.2s`, hasTokens: true },
  { kind: 'token_milestone', template: (a) => `${a} crossed 1M output tokens this month`, hasTokens: false },
  { kind: 'run_complete', template: (a) => `${a} run complete — 4 tool calls`, hasTokens: true },
  { kind: 'run_failed',   template: (a) => `${a} failed — API timeout`, hasTokens: false },
];

function buildActivity(): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  // 40 activity items spread across the last 7 days
  const base = new Date('2026-06-12T18:32:00Z');
  for (let i = 0; i < 40; i++) {
    const seed1 = i * 11;
    const seed2 = i * 7 + 3;
    const seed3 = i * 13 + 5;
    const seed4 = i * 17 + 2;
    const agentId = AGENTS[Math.floor(lcg(seed1) * AGENTS.length)];
    const tpl = ACTIVITY_TEMPLATES[Math.floor(lcg(seed2) * ACTIVITY_TEMPLATES.length)];
    const msBack = Math.floor(lcg(seed3) * 7 * 24 * 60 * 60 * 1000);
    const ts = new Date(base.getTime() - msBack).toISOString();
    const tokens = tpl.hasTokens ? Math.round(800 + lcg(seed4) * 8200) : null;
    const costUsd = tokens
      ? (tokens / 1000) * COST_WEIGHT[agentId] * 2
      : null;
    entries.push({
      id: `act-${i}`,
      agentId,
      agentName: AGENT_META[agentId].name,
      kind: tpl.kind,
      description: tpl.template(AGENT_META[agentId].name),
      tokens,
      costUsd,
      timestamp: ts,
    });
  }
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/* ─── Pre-built datasets for the three windows ────────────────────────────── */

const DAILY_30 = buildDaily(dates(30));
const DAILY_14 = buildDaily(dates(14));
const DAILY_7  = buildDaily(dates(7));
const ACTIVITY = buildActivity();

function buildUsageData(
  daily: DailyAgentUsage[],
  windowLabel: string,
  from: string,
  to: string,
): UsageData {
  const agents = aggregateAgents(daily);
  const totals = {
    runs: agents.reduce((s, a) => s + a.totalRuns, 0),
    inputTokens: agents.reduce((s, a) => s + a.totalInputTokens, 0),
    outputTokens: agents.reduce((s, a) => s + a.totalOutputTokens, 0),
    costUsd: agents.reduce((s, a) => s + a.totalCostUsd, 0),
  };
  return { windowLabel, from, to, daily, agents, totals, activity: ACTIVITY };
}

export type DateWindow = '7d' | '14d' | '30d';

const WINDOW_DATA: Record<DateWindow, UsageData> = {
  '7d':  buildUsageData(DAILY_7,  'Last 7 days',  dates(7)[0],  dates(7)[6]),
  '14d': buildUsageData(DAILY_14, 'Last 14 days', dates(14)[0], dates(14)[13]),
  '30d': buildUsageData(DAILY_30, 'Last 30 days', dates(30)[0], dates(30)[29]),
};

/**
 * Simulates an async API call. In production replace with:
 *   return fetch(`/api/usage?window=${window}`).then(r => r.json());
 */
export async function getUsageData(window: DateWindow): Promise<UsageData> {
  // Simulate a short network delay so loading states are exercised.
  await new Promise<void>((res) => setTimeout(res, 280));
  return WINDOW_DATA[window];
}
