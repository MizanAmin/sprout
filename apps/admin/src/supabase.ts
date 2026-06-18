import { createClient } from '@supabase/supabase-js';

// Browser Supabase client for admin login (OTP email code). Authorisation is NOT
// decided here — any login works; the API's ADMIN_EMAILS allowlist decides who is
// actually a platform admin.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } },
);
