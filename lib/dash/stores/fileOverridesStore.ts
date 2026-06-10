/**
 * fileOverridesStore - zustand slice for per-conversation file overrides
 * (edits / created / deleted), kept separate from chatStore. Ported from aero.
 */

import { create } from "zustand";
import type { FileOverride } from "../types";
import { getFileOverrides } from "../api";

interface FileOverridesState {
  fileOverrides: Record<string, FileOverride[]>;
  fileOverridesLoading: Record<string, boolean>;
  loadFileOverrides: (conversationId: string) => Promise<void>;
  upsertFileOverride: (conversationId: string, override: FileOverride) => void;
  removeFileOverrideFromStore: (conversationId: string, overrideId: string) => void;
  clearFileOverrides: (conversationId: string) => void;
}

export const useFileOverridesStore = create<FileOverridesState>((set, get) => ({
  fileOverrides: {},
  fileOverridesLoading: {},

  loadFileOverrides: async (conversationId) => {
    if (!conversationId) return;
    if (get().fileOverridesLoading[conversationId]) return;
    set((s) => ({ fileOverridesLoading: { ...s.fileOverridesLoading, [conversationId]: true } }));
    try {
      const overrides = await getFileOverrides(conversationId);
      set((s) => ({
        fileOverrides: { ...s.fileOverrides, [conversationId]: overrides },
        fileOverridesLoading: { ...s.fileOverridesLoading, [conversationId]: false },
      }));
    } catch {
      set((s) => ({ fileOverridesLoading: { ...s.fileOverridesLoading, [conversationId]: false } }));
    }
  },

  upsertFileOverride: (conversationId, override) => {
    set((s) => {
      const existing = s.fileOverrides[conversationId] ?? [];
      const idx = existing.findIndex((o) => o.id === override.id);
      let updated: FileOverride[];
      if (idx >= 0) {
        updated = existing.map((o) => (o.id === override.id ? override : o));
      } else {
        const byPath = existing.findIndex((o) => o.filePath === override.filePath);
        updated = byPath >= 0
          ? existing.map((o) => (o.filePath === override.filePath ? override : o))
          : [...existing, override];
      }
      return { fileOverrides: { ...s.fileOverrides, [conversationId]: updated } };
    });
  },

  removeFileOverrideFromStore: (conversationId, overrideId) => {
    set((s) => ({
      fileOverrides: {
        ...s.fileOverrides,
        [conversationId]: (s.fileOverrides[conversationId] ?? []).filter((o) => o.id !== overrideId),
      },
    }));
  },

  clearFileOverrides: (conversationId) => {
    set((s) => {
      const next = { ...s.fileOverrides };
      delete next[conversationId];
      return { fileOverrides: next };
    });
  },
}));

// Stable empty array so the selector never returns a fresh reference (which
// would trigger an infinite re-render loop in zustand v5).
const EMPTY: FileOverride[] = [];
export function useFileOverrides(conversationId: string | undefined): FileOverride[] {
  return useFileOverridesStore((s) =>
    conversationId && s.fileOverrides[conversationId] ? s.fileOverrides[conversationId] : EMPTY,
  );
}
