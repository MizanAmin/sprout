import { useEffect, useState } from 'react';
import { supabase } from '@sprout/db';

export type Role = 'manager' | 'staff' | 'parent';

export type Plan = 'seedling' | 'blossom' | 'grove' | 'forest';
const PLAN_ORDER: Plan[] = ['seedling', 'blossom', 'grove', 'forest'];

/** True if `plan` is at least `min` in the tier order. */
export function planAtLeast(plan: Plan | undefined, min: Plan): boolean {
  if (!plan) return false;
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(min);
}

export interface CurrentUser {
  id: string;
  name: string;
  role: Role;
  nurseryId: number;
  plan: Plan;
}

// Reads the signed-in user's custom claims (role, nursery_id, name) from the
// Supabase session — the same claims the API authorizes against. Used for
// client-side role gating of manager-only nav.
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    type Sess = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
    const read = (session: Sess) => {
      const m = session?.user?.user_metadata as
        | { name?: string; role?: Role; nursery_id?: number | string; plan?: Plan }
        | undefined;
      if (!session || !m) {
        setUser(null);
        return;
      }
      setUser({
        id: session.user.id,
        name: m.name ?? '',
        role: (m.role ?? 'staff') as Role,
        nurseryId: Number(m.nursery_id),
        plan: (m.plan ?? 'seedling') as Plan,
      });
    };
    supabase.auth.getSession().then(({ data }) => read(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => read(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return user;
}
