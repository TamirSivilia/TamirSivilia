import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

interface UserStore {
  user: User | null;
  isGuest: boolean;
  isPremium: boolean;
  displayName: string | null;
  isLoading: boolean;
  guestNudgeShown: boolean;

  setUser: (user: User | null) => void;
  setIsGuest: (isGuest: boolean) => void;
  setIsPremium: (isPremium: boolean) => void;
  setDisplayName: (name: string | null) => void;
  setLoading: (loading: boolean) => void;
  setGuestNudgeShown: (shown: boolean) => void;
  reset: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isGuest: false,
  isPremium: false,
  displayName: null,
  isLoading: true,
  guestNudgeShown: false,

  setUser: (user) => set({ user }),
  setIsGuest: (isGuest) => set({ isGuest }),
  setIsPremium: (isPremium) => set({ isPremium }),
  setDisplayName: (displayName) => set({ displayName }),
  setLoading: (isLoading) => set({ isLoading }),
  setGuestNudgeShown: (guestNudgeShown) => set({ guestNudgeShown }),
  reset: () => set({
    user: null,
    isGuest: false,
    isPremium: false,
    displayName: null,
    isLoading: false,
    guestNudgeShown: false,
  }),
}));
