import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Browser (staff web app) Supabase client. Uses the anon key + Vite env vars.
// The parent native app imports the SecureStore-backed variant from
// `@sprout/db/native` instead. Never import the service-role admin client here.
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);
