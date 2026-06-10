// Preset agents that have a dedicated console (job pipeline / special UI) instead
// of a normal chat. Keyed by the seed agent name → its console route.
// Used by the agents grid (▶ opens console) and the chat composer (selecting one
// of these agents routes to its console instead of starting a plain chat).
export const AGENT_CONSOLE_ROUTE: Record<string, string> = {
  'Project Analyzer': '/dashboard/legitimacy',
  'GitHub Analyzer': '/dashboard/github',
  'Wallet Analyzer': '/dashboard/wallet',
  'YouTube Agent': '/dashboard/youtube',
  'Docs Agent': '/dashboard/docs',
  'X (Twitter) Agent': '/dashboard/xagent',
};
