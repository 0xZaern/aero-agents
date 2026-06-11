/**
 * agentReport.ts
 *
 * Parser and types for the five analyzer agent reports that are stored as
 * JSON-serialised assistant messages. Each report has a "__type__" marker so
 * the chat renderer can detect and present them properly instead of showing
 * raw JSON.
 *
 * Payload shapes confirmed against:
 *   backend/routers/legitimacy.py      ~line 299  (report = markdown string)
 *   backend/routers/wallet_agent.py    ~line 353  (report = markdown string)
 *   backend/routers/github_agent.py    ~line 370  (report = structured dict)
 *   backend/routers/docs_agent.py      ~line 264  (report = structured dict)
 *   backend/routers/youtube_agent.py   ~line 361  (report = structured dict)
 */

// ---------------------------------------------------------------------------
// Legitimacy (Project Analyzer) - report is a markdown string
// ---------------------------------------------------------------------------
export interface LegitimacyReport {
  __type__: '__legitimacy_report__';
  report: string;          // markdown string
  evidence: Record<string, unknown>;
  scanned_at: string;
  project_url: string;
}

// ---------------------------------------------------------------------------
// Wallet Analyzer - report is a markdown string
// ---------------------------------------------------------------------------
export interface WalletReport {
  __type__: '__wallet_agent_report__';
  report: string;          // markdown string
  evidence: Record<string, unknown>;
  address: string;
  chain: string;
  analyzed_at: string;
}

// ---------------------------------------------------------------------------
// GitHub Analyzer - report is a structured object
// Fields from services/github_agent_service.py generate_verdict schema
// ---------------------------------------------------------------------------
export interface GithubReportObject {
  verdict: string;
  confidence?: string;
  what_it_is?: string;
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
  activity?: {
    health: string;
    last_commit_days_ago: number;
    bus_factor: number;
    notes: string[];
  };
  bottom_line: string;
  verify_yourself?: Array<{ label: string; url: string }>;
  data_gaps?: string[];
}

export interface GithubReport {
  __type__: '__github_agent_report__';
  report: GithubReportObject;
  evidence: Record<string, unknown>;
  repo_url: string;
  analyzed_at: string;
}

// ---------------------------------------------------------------------------
// Docs Agent - report is a structured object
// Fields from services/docs_agent_service.py CARD_GENERATOR_SYSTEM schema
// ---------------------------------------------------------------------------
export interface DocsReportObject {
  verdict: string;           // SOLID | ADEQUATE | SLOPPY | EMPTY
  verdictReason?: string;
  tldr?: string;
  summary?: string;
  keyBenefits: string[];
  slopScore: number;
  slopReasons?: string[];
  techStack?: string[];
  targetAudience?: string;
  redFlags?: string[];
  framework?: string;
  socials?: Record<string, string | null>;
}

export interface DocsReport {
  __type__: '__docs_agent_report__';
  report: DocsReportObject;
  evidence: Record<string, unknown>;
  url: string;
  analyzed_at: string;
}

// ---------------------------------------------------------------------------
// YouTube Agent - report is a structured object
// Fields from services/youtube_agent_service.py generate_summary schema
// ---------------------------------------------------------------------------
export interface YoutubeReportObject {
  tldr: string;
  what_it_is_about?: string;
  key_points?: Array<{ point: string; why_matters: string; timestamp_seconds?: number }>;
  causes_or_background?: string[];
  solutions_or_takeaways?: string[];
  quotes?: Array<{ text: string; timestamp_seconds?: number }>;
  chapters?: Array<{ title: string; start_seconds: number }>;
  topics?: string[];
  content_type?: string;
}

export interface YoutubeReport {
  __type__: '__youtube_agent_report__';
  report: YoutubeReportObject;
  evidence: Record<string, unknown>;
  video_url: string;
  analyzed_at: string;
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------
export type AgentReport =
  | LegitimacyReport
  | WalletReport
  | GithubReport
  | DocsReport
  | YoutubeReport;

export type AgentReportType = AgentReport['__type__'];

// ---------------------------------------------------------------------------
// Marker type -> console route map (used for chat redirect and card links)
// ---------------------------------------------------------------------------
export const REPORT_CONSOLE_PATH: Record<AgentReportType, string> = {
  '__wallet_agent_report__': '/dashboard/wallet',
  '__github_agent_report__': '/dashboard/github',
  '__legitimacy_report__':   '/dashboard/legitimacy',
  '__docs_agent_report__':   '/dashboard/docs',
  '__youtube_agent_report__': '/dashboard/youtube',
};

const KNOWN_TYPES = new Set<string>([
  '__legitimacy_report__',
  '__wallet_agent_report__',
  '__github_agent_report__',
  '__docs_agent_report__',
  '__youtube_agent_report__',
]);

/**
 * Try to parse a message content string as one of the five agent reports.
 * Returns the typed payload or null if the content is plain text / unknown JSON.
 */
export function parseAgentReport(content: string): AgentReport | null {
  if (!content.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.__type__ === 'string' && KNOWN_TYPES.has(parsed.__type__)) {
      return parsed as unknown as AgentReport;
    }
  } catch {
    // not valid JSON - fall through
  }
  return null;
}

// ---------------------------------------------------------------------------
// Metadata helpers used by the UI layer
// ---------------------------------------------------------------------------

export interface AgentReportMeta {
  label: string;         // short uppercase label, e.g. "wallet analyzer report"
  consolePath: string;   // /dashboard/... route for "open in console" link
  metaLine: string;      // key context shown next to the label, e.g. "0xabc... / eth"
}

export function getAgentReportMeta(report: AgentReport): AgentReportMeta {
  switch (report.__type__) {
    case '__legitimacy_report__':
      return {
        label: 'project analyzer report',
        consolePath: '/dashboard/legitimacy',
        metaLine: report.project_url,
      };
    case '__wallet_agent_report__':
      return {
        label: 'wallet analyzer report',
        consolePath: '/dashboard/wallet',
        metaLine: `${report.address} / ${report.chain}`,
      };
    case '__github_agent_report__':
      return {
        label: 'github analyzer report',
        consolePath: '/dashboard/github',
        metaLine: report.repo_url,
      };
    case '__docs_agent_report__':
      return {
        label: 'docs agent report',
        consolePath: '/dashboard/docs',
        metaLine: report.url,
      };
    case '__youtube_agent_report__':
      return {
        label: 'youtube agent report',
        consolePath: '/dashboard/youtube',
        metaLine: report.video_url,
      };
  }
}
