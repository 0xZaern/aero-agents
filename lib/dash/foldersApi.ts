import type { Conversation, Folder, FolderColor, SearchResult } from './types';

const BASE_URL = '';

function makeApiError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.name = 'ApiError';
  err.status = status;
  return err;
}

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
      ...options?.headers,
    },
    ...options,
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

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

/* ─── Folders ─── */
export const listFolders = (): Promise<Folder[]> =>
  request<Folder[]>('/api/folders');

export const createFolder = (name: string, color?: FolderColor): Promise<Folder> =>
  request<Folder>('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });

export const updateFolder = (
  id: string,
  data: { name?: string; color?: FolderColor }
): Promise<Folder> =>
  request<Folder>(`/api/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteFolder = (id: string): Promise<void> =>
  request<void>(`/api/folders/${id}`, { method: 'DELETE' });

/* ─── Conversation organization ─── */
export const moveConversation = (
  convId: string,
  folderId: string | null
): Promise<Conversation> =>
  request<Conversation>(`/api/conversations/${convId}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ folderId }),
  });

export const pinConversation = (
  convId: string,
  isPinned: boolean
): Promise<Conversation> =>
  request<Conversation>(`/api/conversations/${convId}/pin`, {
    method: 'PATCH',
    body: JSON.stringify({ isPinned }),
  });

/* ─── Search ─── */
export const searchConversations = (
  q: string,
  limit = 100
): Promise<SearchResult[]> =>
  request<SearchResult[]>(
    `/api/conversations/search?q=${encodeURIComponent(q)}&limit=${limit}`
  );

/* ─── Bulk actions ─── */
export const bulkAction = (
  ids: string[],
  action: 'move' | 'delete' | 'pin' | 'unpin',
  folderId?: string | null
): Promise<{ affected: number }> =>
  request<{ affected: number }>('/api/conversations/bulk-action', {
    method: 'POST',
    body: JSON.stringify({
      conversationIds: ids,
      action,
      ...(folderId !== undefined ? { folderId } : {}),
    }),
  });
