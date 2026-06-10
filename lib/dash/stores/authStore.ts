import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  walletAddress: string;
  credits: number;
  plan: string; // "basic" or "pro"
  pro_expires_at?: string | null;
  avatarVariant?: string | null;
  themeOverrides?: string | null; // JSON string of dashboard CSS var overrides (per wallet)
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  updateCredits: (credits: number) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
  isPro: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token: string, user: AuthUser) =>
        set({ token, user, isAuthenticated: true }),

      updateCredits: (credits: number) =>
        set((state) => ({
          user: state.user ? { ...state.user, credits } : null,
        })),

      updateUser: (patch: Partial<AuthUser>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
        })),

      logout: () => {
        // Drop cached sidebar list + message history so the next wallet that
        // logs in on this browser can't see the previous user's chats.
        import('./chatStore').then((m) => {
          m.clearChatCache();
          m.useChatStore.getState().setConversations([]);
        }).catch(() => {});
        set({ token: null, user: null, isAuthenticated: false });
      },

      isPro: () => {
        return get().user?.plan === 'pro';
      },
    }),
    {
      name: 'conductor-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }) as AuthState,
      onRehydrateStorage: () => (state) => {
        // Recompute isAuthenticated after rehydration in case something was wiped
        if (state && state.token === null) {
          state.isAuthenticated = false;
        }
      },
    }
  )
);
