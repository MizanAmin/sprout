import { create } from 'zustand';

export type Role = 'manager' | 'staff' | 'parent';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  nurseryId: number;
  childIds: number[];
}

export interface Child {
  id: number;
  name: string;
  dob: string | null;
  room: string;
  photo_url: string;
}

export interface Nursery {
  id: number;
  name: string;
  plan: string;
  logo_url?: string;
}

interface AppState {
  user: AuthUser | null;
  nursery: Nursery | null;
  // All children for this parent (from /api/parent/children) + the active one.
  // Every child-scoped query uses activeChildId as a query-key dependency, so
  // switching child invalidates those queries automatically.
  children: Child[];
  activeChildId: number | null;
  setUser: (user: AuthUser | null) => void;
  setNursery: (nursery: Nursery | null) => void;
  setChildren: (children: Child[]) => void;
  setActiveChild: (id: number) => void;
  reset: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  nursery: null,
  children: [],
  activeChildId: null,
  setUser: (user) => set({ user }),
  setNursery: (nursery) => set({ nursery }),
  setChildren: (children) =>
    set({
      children,
      // Default the active child to the first one if not already set/valid.
      activeChildId:
        get().activeChildId && children.some((c) => c.id === get().activeChildId)
          ? get().activeChildId
          : (children[0]?.id ?? null),
    }),
  setActiveChild: (id) => set({ activeChildId: id }),
  reset: () => set({ user: null, nursery: null, children: [], activeChildId: null }),
}));
