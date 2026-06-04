'use client';

import { useCallback, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import { useAuthStore } from './authStore';

// Controls the floating "connect" modal opened from the landing's Launch App buttons.
interface AuthModalState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useAuthModal = create<AuthModalState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

// Launch App behaviour: if already signed in, go straight to the console;
// otherwise pop the floating connect modal.
export function useLaunch() {
  const router = useRouter();
  const setOpen = useAuthModal((s) => s.setOpen);
  return useCallback((e?: MouseEvent) => {
    e?.preventDefault();
    if (useAuthStore.getState().isAuthenticated) router.push('/dashboard/chat');
    else setOpen(true);
  }, [router, setOpen]);
}
