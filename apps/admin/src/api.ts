import { supabase } from './supabase';

// Admin API client. Auth is a real Supabase login — the access token is sent as a
// Bearer header; the API's ADMIN_EMAILS allowlist gates access (403 if not listed).
const BASE = import.meta.env.VITE_API_URL;

export type ApiError = Error & { code?: string; status?: number };

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
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
  delete: <T>(p: string) => req<T>('DELETE', p),
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

export interface NurseryUser {
  id: string;
  name: string;
  email: string;
  role: 'manager' | 'staff' | 'parent';
  created_at: string | null;
  child_count: number;
}
