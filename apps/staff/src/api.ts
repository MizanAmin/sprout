import { supabase } from '@sprout/db';

const BASE = import.meta.env.VITE_API_URL;

// Email second-factor proof, stored per-browser. Sent as X-MFA-Token so the API
// can enforce the second factor on every request (see requireMfa on the server).
const MFA_KEY = 'sprout.mfaToken';
export const getMfaToken = () => localStorage.getItem(MFA_KEY) ?? '';
export const setMfaToken = (t: string) => localStorage.setItem(MFA_KEY, t);
export const clearMfaToken = () => localStorage.removeItem(MFA_KEY);

function authHeaders(accessToken?: string): Record<string, string> {
  const mfa = getMfaToken();
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(mfa ? { 'X-MFA-Token': mfa } : {}),
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(session?.access_token),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText, code: 'UNKNOWN' }));
    throw Object.assign(new Error(err.error), { code: err.code, status: res.status });
  }
  return res.json() as Promise<T>;
}

// Multipart upload (FormData) — no JSON Content-Type so the browser sets the
// multipart boundary. Used for file uploads to /uploads.
async function upload<T>(path: string, formData: FormData): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(session?.access_token),
    body: formData,
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
  upload,
};
