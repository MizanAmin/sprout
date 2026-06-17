import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Service role client — API server ONLY. Used for auth admin operations, storage
// uploads, and OTP. NEVER import this in apps/staff or apps/parent: it would leak
// the service role key into a frontend bundle.

// Singleton — one admin client per process
let _admin: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  _admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

// Convenience alias used throughout the API routes. A lazy proxy so merely
// importing this module does NOT require the env vars to be set yet — the client
// is created on first property access (e.g. `supabaseAdmin.auth`), not at import.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof getSupabaseAdmin>, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseAdmin() as object, prop, receiver);
  },
});
