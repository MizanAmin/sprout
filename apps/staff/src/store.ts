import { create } from 'zustand';

export type Role = 'manager' | 'staff' | 'parent';
export type Plan = 'seedling' | 'blossom' | 'grove' | 'forest' | 'cancelled';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  nurseryId: number;
}

export interface Nursery {
  id: number;
  name: string;
  plan: Plan;
  trialEndsAt?: string | null;
}

interface AppState {
  user: AuthUser | null;
  nursery: Nursery | null;
  setUser: (user: AuthUser | null) => void;
  setNursery: (nursery: Nursery | null) => void;
  reset: () => void;
}

// Auth user + nursery context only — all server data lives in TanStack Query.
export const useStore = create<AppState>((set) => ({
  user: null,
  nursery: null,
  setUser: (user) => set({ user }),
  setNursery: (nursery) => set({ nursery }),
  reset: () => set({ user: null, nursery: null }),
}));
