import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, pool } from '../db';

// Public auth flows. No requireAuth — these are the entry points before a session
// exists. register-nursery spans three systems (nurseries row, Supabase Auth user,
// public.users row); the others are thin wrappers over Supabase Auth.
//
// Public auth operations (sign-in, OTP, password reset) use the ANON client —
// not the service-role admin client, which is only for privileged admin calls
// (createUser/deleteUser). Lazy so the module imports without env set.
let _anon: ReturnType<typeof createClient> | null = null;
function getAnon() {
  if (_anon) return _anon;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  _anon = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return _anon;
}

const app = new Hono();

// --- POST /register-nursery ---------------------------------------------------
const registerSchema = z.object({
  nurseryName: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

app.post('/register-nursery', zValidator('json', registerSchema), async (c) => {
  const { nurseryName, name, email, password } = c.req.valid('json');

  // 1) Create the nursery directly (no tenant context exists yet).
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO nurseries (name, email, plan, trial_ends_at)
     VALUES ($1, $2, 'seedling', NOW() + INTERVAL '14 days')
     RETURNING id`,
    [nurseryName, email],
  );
  const nurseryId = rows[0].id;

  // 2) Create the auth user with custom claims (email pre-confirmed for web).
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nursery_id: nurseryId, role: 'manager', name, child_ids: [], plan: 'seedling' },
  });
  if (error || !data?.user) {
    // Best-effort rollback of the orphaned nursery so a retry can reuse the email.
    await pool.query('DELETE FROM nurseries WHERE id=$1', [nurseryId]).catch(() => {});
    return c.json({ error: error?.message ?? 'Failed to create user', code: 'INTERNAL_ERROR' }, 500);
  }
  const authUserId = data.user.id;

  // 3) Mirror into public.users.
  try {
    await pool.query(
      'INSERT INTO users (id, nursery_id, name, email, role) VALUES ($1,$2,$3,$4,$5)',
      [authUserId, nurseryId, name, email, 'manager'],
    );
  } catch (err) {
    // Roll back both the auth user and the nursery on a failed profile insert.
    await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
    await pool.query('DELETE FROM nurseries WHERE id=$1', [nurseryId]).catch(() => {});
    return c.json({ error: 'Failed to create nursery', code: 'INTERNAL_ERROR' }, 500);
  }

  return c.json({ nurseryId, userId: authUserId }, 201);
});

// --- POST /login --------------------------------------------------------------
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const { data, error } = await getAnon().auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    return c.json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' }, 401);
  }
  return c.json({ session: data.session, user: data.user });
});

// --- POST /forgot-password ----------------------------------------------------
const forgotSchema = z.object({ email: z.string().email() });

app.post('/forgot-password', zValidator('json', forgotSchema), async (c) => {
  const { email } = c.req.valid('json');
  // Fire-and-forget: never leak whether the email maps to an account.
  await getAnon().auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.STAFF_APP_URL}/reset-password`,
  });
  return c.json({ ok: true });
});

// --- POST /send-otp -----------------------------------------------------------
const sendOtpSchema = z.object({ email: z.string().email() });

app.post('/send-otp', zValidator('json', sendOtpSchema), async (c) => {
  const { email } = c.req.valid('json');
  const { error } = await getAnon().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false }, // parent must already exist
  });
  if (error) {
    return c.json({ error: error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  return c.json({ ok: true });
});

// --- POST /verify-otp ---------------------------------------------------------
const verifyOtpSchema = z.object({
  email: z.string().email(),
  token: z.string().min(4),
});

app.post('/verify-otp', zValidator('json', verifyOtpSchema), async (c) => {
  const { email, token } = c.req.valid('json');
  const { data, error } = await getAnon().auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data?.session) {
    return c.json({ error: 'Invalid or expired code', code: 'UNAUTHORIZED' }, 401);
  }
  return c.json({ session: data.session });
});

export default app;
