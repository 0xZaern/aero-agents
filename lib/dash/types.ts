export interface Model {
  id: string;
  provider: "anthropic" | "openai" | "google" | "deepseek" | "meta" | "xai" | "moonshot" | "alibaba" | "zhipu" | "minimax";
  name: string;
  displayName: string;
  inputCostPer1K: number;
  outputCostPer1K: number;
  maxTokens: number;
  isActive: boolean;
  supportsVision: boolean;
  supportsDocuments: boolean;
}

export interface AttachmentOut {
  id: string;
  userId: string;
  messageId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'pdf' | 'document' | 'spreadsheet' | 'other';
  publicUrl: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  agentId?: string;
  crewId?: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: string;
  folderId?: string | null;
  isPinned: boolean;
}

export type FolderColorPreset = 'none' | 'purple' | 'green' | 'blue' | 'orange' | 'red';
// FolderColor can be a preset name OR a hex string like "#a3f1c2"
export type FolderColor = FolderColorPreset | string;

export const FOLDER_COLOR_CLASS: Record<FolderColorPreset, string> = {
  none: 'bg-transparent',
  purple: 'bg-[var(--folder-purple)]',
  green: 'bg-[var(--folder-green)]',
  blue: 'bg-[var(--folder-blue)]',
  orange: 'bg-[var(--folder-orange)]',
  red: 'bg-[var(--folder-red)]',
};

export const FOLDER_COLOR_TEXT: Record<FolderColorPreset, string> = {
  none: 'text-[var(--text-tertiary)]',
  purple: 'text-[var(--folder-purple)]',
  green: 'text-[var(--folder-green)]',
  blue: 'text-[var(--folder-blue)]',
  orange: 'text-[var(--folder-orange)]',
  red: 'text-[var(--folder-red)]',
};

// Helper to check if a color is a preset
export function isPresetColor(color: string): color is FolderColorPreset {
  return ['none', 'purple', 'green', 'blue', 'orange', 'red'].includes(color);
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  color: FolderColor;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  conversationId: string;
  conversationTitle: string;
  folderId: string | null;
  snippet: string;
  matchedInTitle: boolean;
  matchedInMessage: boolean;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  createdAt: string;
  attachments?: AttachmentOut[];
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  goal?: string;
  backstory?: string;
  modelId: string;
  tools: string[];
  temperature: number;
  maxTokens: number;
  isPreset: boolean;
  publicDescription?: string | null;  // marketing copy for preset agents, null for custom
  recommendedModels?: { modelId: string; tier: 'budget' | 'average' | 'pro' }[];
  isPublished: boolean;
  sourceAgentId: string | null;
  publishedAt: string | null;  // ISO timestamp
  unlisted: boolean;
  removedByAdmin: boolean;
  authorDisplayName: string | null;
  reportCount?: number;
}

export interface Crew {
  id: string;
  name: string;
  description?: string;
  processType: "sequential" | "hierarchical";
  agentIds: string[];
  isPreset: boolean;
}

export interface CrewExecution {
  id: string;
  crewId: string;
  taskDescription: string;
  status: "running" | "completed" | "failed" | "cancelled";
  result?: string;
  executionLog: ExecutionStep[];
  totalCost?: number;
  totalTokens?: number;
  startedAt: string;
  completedAt?: string;
}

export interface ExecutionStep {
  agentId: string;
  agentName: string;
  status: "waiting" | "running" | "completed" | "failed";
  action: string;
  output?: string;
  tokens?: number;
  cost?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface CostSummary {
  thisMonth: number;
  allTime: number;
  byModel: { modelId: string; displayName: string; cost: number }[];
  daily: { date: string; cost: number }[];
}

export interface AgentTestResponse {
  response: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

export interface ToolEvent {
  type: 'tool_use' | 'tool_result';
  tool: string;
  content: string;
  timestamp: string;
}

/* ─── File Overrides ─── */

export interface FileOverride {
  id: string;
  conversationId: string;
  filePath: string;
  content: string;
  language: string;
  source: 'edit' | 'created' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedFile {
  path: string;
  content: string;
  language: string;
  messageId: string;
  createdAt: string;
}

export interface MergedFile {
  path: string;
  content: string;
  language: string;
  source: 'ai' | 'edit' | 'created';
  overrideId?: string;
  originalContent?: string;
  createdAt: string;
}

/* ─── WebSocket message types ─── */
export type WsIncoming =
  | { type: 'token'; content: string }
  | { type: 'message_complete'; message: Message }
  | { type: 'error'; content: string }
  | { type: 'tool_use'; content: string; tool: string }
  | { type: 'tool_result'; content: string; tool: string }
  | { type: 'crew_agent_start'; agentName: string; step: number; totalSteps: number }
  | { type: 'crew_agent_complete'; agentName: string; step: number }
  | { type: 'title_updated'; title: string };

export type WsOutgoing = {
  content: string;
  model_id?: string;
  attachment_ids?: string[];
  regenerate?: boolean;
  edit_last?: boolean;
};

/* ─── Crew Execution WebSocket event types ─── */
export type CrewEvent =
  | { type: 'execution_start'; executionId: string; crewName: string }
  | { type: 'agent_start'; agentId: string; agentName: string; step: number; totalSteps: number }
  | { type: 'tool_use'; agentId: string; tool: string; content: string }
  | { type: 'tool_result'; agentId: string; tool: string; content: string }
  | { type: 'agent_complete'; agentId: string; agentName: string; output: string; tokens: number; cost: number; duration: number }
  | { type: 'crew_complete'; result: string; totalCost: number; totalTokens: number; duration: number }
  | { type: 'crew_error'; agentId: string; error: string }
  | { type: 'crew_cancelled' };
