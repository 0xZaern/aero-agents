import { create } from 'zustand';
import type { Agent, Conversation, Folder, Message, SearchResult, ToolEvent } from '../types';

/* ─── localStorage helpers for Set<string> ─── */
const COLLAPSED_KEY = 'aero.collapsedFolderIds';

function loadCollapsedFolderIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveCollapsedFolderIds(ids: Set<string>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

/* ─── localStorage cache: sidebar list + per-conversation messages ───
   Lets history render INSTANTLY on load / re-open while the network call
   revalidates in the background (stale-while-revalidate). Cleared on logout. */
const CONVS_KEY = 'aero.conversations';
const MSGCACHE_KEY = 'aero.msgcache';
const MSGCACHE_MAX_CONVS = 30; // cap so we don't blow the localStorage quota

export function clearChatCache(): void {
  try {
    localStorage.removeItem(CONVS_KEY);
    localStorage.removeItem(MSGCACHE_KEY);
  } catch { /* ignore */ }
}

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = JSON.parse(localStorage.getItem(CONVS_KEY) ?? 'null');
    return Array.isArray(arr) ? (arr as Conversation[]) : [];
  } catch { return []; }
}
function saveConversations(convs: Conversation[]): void {
  try { localStorage.setItem(CONVS_KEY, JSON.stringify(convs.slice(0, 200))); } catch { /* ignore */ }
}

function loadMsgCache(): Record<string, Message[]> {
  if (typeof window === 'undefined') return {};
  try {
    const obj = JSON.parse(localStorage.getItem(MSGCACHE_KEY) ?? 'null');
    return obj && typeof obj === 'object' ? (obj as Record<string, Message[]>) : {};
  } catch { return {}; }
}
function saveMsgCache(cache: Record<string, Message[]>): void {
  try {
    let entries = Object.entries(cache);
    if (entries.length > MSGCACHE_MAX_CONVS) entries = entries.slice(-MSGCACHE_MAX_CONVS);
    localStorage.setItem(MSGCACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* quota exceeded - skip */ }
}

// Set messages for the current conversation AND mirror them to the persisted
// cache (LRU: re-insert so the conversation moves to the end).
function withCache(
  state: { currentConversationId: string | null; messageCache: Record<string, Message[]> },
  messages: Message[],
): { messages: Message[]; messageCache?: Record<string, Message[]> } {
  const id = state.currentConversationId;
  if (!id) return { messages };
  const cache = { ...state.messageCache };
  delete cache[id]; cache[id] = messages;
  saveMsgCache(cache);
  return { messages, messageCache: cache };
}

interface PendingMessage {
  content: string;
  modelId?: string;
  attachmentIds?: string[];
}

export interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  messageCache: Record<string, Message[]>;
  streamingMessage: string;
  isStreaming: boolean;
  selectedModelId: string;
  selectedAgentId: string | null;
  selectedCrewId: string | null;
  crewProgress: { agentName: string; step: number; totalSteps: number } | null;
  crewCompletedAgents: string[];
  toolEvents: ToolEvent[];
  pendingMessage: PendingMessage | null;

  /* ─── Agent cache - populated by ChatView on first load ─── */
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;

  /* ─── Chat Organization ─── */
  folders: Folder[];
  selectedIds: Set<string>;
  bulkMode: boolean;
  searchResults: SearchResult[] | null;
  searchQuery: string;
  isSearching: boolean;
  collapsedFolderIds: Set<string>;

  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, data: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setCurrentConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  primeCache: (convId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendToken: (token: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  clearStreamingMessage: () => void;
  finalizeStreamingMessage: (message: Message) => void;
  setSelectedModelId: (id: string) => void;
  setSelectedAgentId: (id: string | null) => void;
  setSelectedCrewId: (id: string | null) => void;
  setCrewProgress: (progress: { agentName: string; step: number; totalSteps: number } | null) => void;
  addCrewCompletedAgent: (name: string) => void;
  clearCrewCompletedAgents: () => void;
  selectAgent: (agentId: string | null, modelId?: string) => void;
  addToolEvent: (event: ToolEvent) => void;
  clearToolEvents: () => void;
  setPendingMessage: (msg: PendingMessage) => void;
  clearPendingMessage: () => void;
  removeLastAssistantMessage: () => Message | null;
  lastError: string | null;
  setLastError: (e: string | null) => void;

  /* ─── Chat Organization Actions ─── */
  setFolders: (folders: Folder[]) => void;
  addFolder: (folder: Folder) => void;
  updateFolder: (id: string, data: Partial<Folder>) => void;
  removeFolder: (id: string) => void;
  moveConversation: (convId: string, folderId: string | null) => void;
  togglePin: (convId: string) => void;
  setBulkMode: (on: boolean) => void;
  toggleSelected: (convId: string) => void;
  clearSelection: () => void;
  setSearchQuery: (q: string) => void;
  setSearchResults: (results: SearchResult[] | null) => void;
  setIsSearching: (isSearching: boolean) => void;
  toggleFolderCollapsed: (folderId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: loadConversations(),
  currentConversationId: null,
  messages: [],
  streamingMessage: '',
  isStreaming: false,
  selectedModelId: 'claude-sonnet-4-6',
  selectedAgentId: null,
  selectedCrewId: null,
  crewProgress: null,
  crewCompletedAgents: [],
  toolEvents: [],
  pendingMessage: null,
  lastError: null,

  /* ─── Agent cache initial state ─── */
  agents: [],
  setAgents: (agents) => set({ agents }),

  /* ─── Chat Organization initial state ─── */
  folders: [],
  selectedIds: new Set(),
  bulkMode: false,
  searchResults: null,
  searchQuery: '',
  isSearching: false,
  collapsedFolderIds: loadCollapsedFolderIds(),

  messageCache: loadMsgCache(),

  setConversations: (conversations) => { saveConversations(conversations); set({ conversations }); },

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  updateConversation: (id, data) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    })),

  setCurrentConversation: (id) =>
    set((state) => ({
      currentConversationId: id,
      // Render cached history instantly; the load effect revalidates it.
      messages: id ? (state.messageCache[id] ?? []) : [],
      streamingMessage: '',
      isStreaming: false,
    })),

  setMessages: (messages) => set((state) => withCache(state, messages)),

  // Warm the cache for a conversation WITHOUT touching the visible view -
  // used by the background prefetch that runs after login.
  primeCache: (convId, messages) =>
    set((state) => {
      const cache = { ...state.messageCache };
      delete cache[convId]; cache[convId] = messages;
      saveMsgCache(cache);
      return { messageCache: cache };
    }),

  addMessage: (message) =>
    set((state) => withCache(state, [...state.messages, message])),

  appendToken: (token) =>
    set((state) => ({ streamingMessage: state.streamingMessage + token })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  clearStreamingMessage: () => set({ streamingMessage: '' }),

  setLastError: (e) => set({ lastError: e }),

  finalizeStreamingMessage: (message) =>
    set((state) => ({
      ...withCache(state, [...state.messages, message]),
      streamingMessage: '',
      isStreaming: false,
      lastError: null,
    })),

  setSelectedModelId: (id) => set({ selectedModelId: id }),

  setSelectedAgentId: (id) => set({ selectedAgentId: id }),

  setSelectedCrewId: (id) => set({ selectedCrewId: id }),

  setCrewProgress: (progress) => set({ crewProgress: progress }),

  addCrewCompletedAgent: (name) =>
    set((state) => ({ crewCompletedAgents: [...state.crewCompletedAgents, name] })),

  clearCrewCompletedAgents: () => set({ crewCompletedAgents: [] }),

  selectAgent: (agentId, modelId) => {
    set(modelId
      ? { selectedAgentId: agentId, selectedModelId: modelId }
      : { selectedAgentId: agentId }
    );
  },

  addToolEvent: (event) =>
    set((state) => ({ toolEvents: [...state.toolEvents, event] })),

  clearToolEvents: () => set({ toolEvents: [] }),

  setPendingMessage: (msg) => set({ pendingMessage: msg }),

  clearPendingMessage: () => set({ pendingMessage: null }),

  /* ─── Chat Organization Action Implementations ─── */
  setFolders: (folders) => set({ folders }),

  addFolder: (folder) =>
    set((state) => ({ folders: [...state.folders, folder] })),

  updateFolder: (id, data) =>
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, ...data } : f)),
    })),

  removeFolder: (id) =>
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      // Move conversations out of the deleted folder
      conversations: state.conversations.map((c) =>
        c.folderId === id ? { ...c, folderId: null } : c
      ),
    })),

  moveConversation: (convId, folderId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, folderId } : c
      ),
    })),

  togglePin: (convId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, isPinned: !c.isPinned } : c
      ),
    })),

  setBulkMode: (on) =>
    set((state) => ({
      bulkMode: on,
      selectedIds: on ? state.selectedIds : new Set(),
    })),

  toggleSelected: (convId) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      // Auto-exit bulk mode when the user manually unselects the last chat
      if (next.size === 0 && state.bulkMode) {
        return { selectedIds: next, bulkMode: false };
      }
      return { selectedIds: next };
    }),

  clearSelection: () => set({ selectedIds: new Set(), bulkMode: false }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  setSearchResults: (results) => set({ searchResults: results }),

  setIsSearching: (isSearching) => set({ isSearching }),

  toggleFolderCollapsed: (folderId) =>
    set((state) => {
      const next = new Set(state.collapsedFolderIds);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      saveCollapsedFolderIds(next);
      return { collapsedFolderIds: next };
    }),

  removeLastAssistantMessage: (): Message | null => {
    const messages = get().messages;

    // findLastIndex replacement - iterate backwards for Safari < 17.2 compatibility
    let lastIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') { lastIdx = i; break; }
    }
    if (lastIdx === -1) return null;

    // findLast replacement - iterate backwards over the slice before lastIdx
    let userMsg: Message | null = null;
    for (let i = lastIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { userMsg = messages[i]; break; }
    }

    set((state) => withCache(state, messages.filter((_: Message, i: number) => i !== lastIdx)));
    return userMsg;
  },
}));
