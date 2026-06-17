import { supabase } from '@sprout/db';

const BASE = import.meta.env.VITE_API_URL;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
    throw Object.assign(new Error(err.error), { code: err.code, status: res.status });
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
