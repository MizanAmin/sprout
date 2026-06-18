// Admin API client. Auth is the X-Admin-Key shared secret entered at the gate and
// held only in sessionStorage (cleared when the tab closes) — never bundled.
const BASE = import.meta.env.VITE_API_URL;
const KEY_STORE = 'sprout.adminKey';

export const getKey = () => sessionStorage.getItem(KEY_STORE) ?? '';
export const setKey = (k: string) => sessionStorage.setItem(KEY_STORE, k);
export const clearKey = () => sessionStorage.removeItem(KEY_STORE);

export type ApiError = Error & { code?: string; status?: number };

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': getKey() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText, code: 'UNKNOWN' }));
    throw Object.assign(new Error(err.error || res.statusText) as ApiError, {
      code: err.code,
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => req<T>('GET', p),
  post: <T>(p: string, b: unknown) => req<T>('POST', p, b),
  patch: <T>(p: string, b: unknown) => req<T>('PATCH', p, b),
};

export type Plan = 'seedling' | 'blossom' | 'grove' | 'forest' | 'cancelled';

export interface Nursery {
  id: number;
  name: string;
  email: string;
  plan: Plan;
  status: 'active' | 'suspended';
  trial_ends_at: string | null;
  created_at: string | null;
  stripe_subscription_id: string;
  user_count: number;
}
