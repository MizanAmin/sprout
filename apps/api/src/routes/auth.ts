import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { SignJWT } from 'jose';
import { randomInt, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { mfaSecret } from '../middleware/requireMfa';
import { sendEmail } from '../services/email';
import type { HonoEnv } from '../types';

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

const app = new Hono<HonoEnv>();

// Shared 6-digit email-code helpers (parent login OTP + staff MFA). Codes are
// stored hashed with a short TTL and an attempt cap, and emailed via Resend.
const CODE_TTL_MIN = 10;
const CODE_MAX_ATTEMPTS = 5;
const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');
const genCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

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

// --- POST /send-otp — parent login: our own 6-digit code via Resend -----------
// Self-owned OTP, independent of Supabase's email templates. We generate, store
// (hashed), and email the code ourselves; /verify-otp checks it and then mints a
// real Supabase session via a server-generated magic link (no email sent there).
const sendOtpSchema = z.object({ email: z.string().email() });

// Reviewer demo account: App Review can't receive OTP emails, so when DEMO_EMAIL
// + DEMO_CODE are set in the API env, that one email signs in with the fixed code
// (no email sent, no DB code stored). The demo user must exist as a parent.
const demoEmail = () => (process.env.DEMO_EMAIL ?? '').trim().toLowerCase();
const demoCode = () => (process.env.DEMO_CODE ?? '').trim();

app.post('/send-otp', zValidator('json', sendOtpSchema), async (c) => {
  const email = c.req.valid('json').email.trim().toLowerCase();
  // Demo account: pretend a code was sent (the fixed DEMO_CODE is used instead).
  if (demoEmail() && email === demoEmail()) return c.json({ ok: true });
  // Only email a code to an existing account — but never leak which emails exist.
  const { rows } = await pool.query('SELECT 1 FROM users WHERE lower(email)=$1', [email]);
  if (rows.length) {
    const code = genCode();
    await pool.query(
      `INSERT INTO login_codes (email, code_hash, expires_at, attempts)
       VALUES ($1, $2, NOW() + make_interval(mins => $3), 0)
       ON CONFLICT (email) DO UPDATE
         SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
             attempts = 0, created_at = NOW()`,
      [email, hashCode(code), CODE_TTL_MIN],
    );
    await sendEmail({
      to: email,
      subject: 'Your Sprout sign-in code',
      html: `<p>Your Sprout sign-in code is <strong style="font-size:22px;letter-spacing:3px">${code}</strong>.</p>
             <p>It expires in ${CODE_TTL_MIN} minutes. If you didn't request it, you can ignore this email.</p>`,
    });
  }
  return c.json({ ok: true });
});

// --- POST /verify-otp — check our code, mint a Supabase session ---------------
const verifyOtpSchema = z.object({
  email: z.string().email(),
  token: z.string().min(4).max(8),
});

app.post('/verify-otp', zValidator('json', verifyOtpSchema), async (c) => {
  const email = c.req.valid('json').email.trim().toLowerCase();
  const code = c.req.valid('json').token.trim();

  // Reviewer demo account skips the emailed-code check (see send-otp).
  const isDemo = demoEmail() !== '' && email === demoEmail() && demoCode() !== '' && code === demoCode();

  if (!isDemo) {
    const { rows } = await pool.query<{ code_hash: string; expires_at: string; attempts: number }>(
      'SELECT code_hash, expires_at, attempts FROM login_codes WHERE email=$1',
      [email],
    );
    const row = rows[0];
    if (!row) return c.json({ error: 'Invalid or expired code', code: 'UNAUTHORIZED' }, 401);
    if (new Date(row.expires_at) < new Date()) {
      await pool.query('DELETE FROM login_codes WHERE email=$1', [email]);
      return c.json({ error: 'Code expired — request a new one', code: 'UNAUTHORIZED' }, 401);
    }
    if (row.attempts >= CODE_MAX_ATTEMPTS) {
      return c.json({ error: 'Too many attempts — request a new code', code: 'UNAUTHORIZED' }, 429);
    }
    if (row.code_hash !== hashCode(code)) {
      await pool.query('UPDATE login_codes SET attempts = attempts + 1 WHERE email=$1', [email]);
      return c.json({ error: 'Incorrect code', code: 'UNAUTHORIZED' }, 401);
    }
    await pool.query('DELETE FROM login_codes WHERE email=$1', [email]);
  }

  // Mint a real Supabase session without a password: generate a magic-link token
  // server-side (this does NOT send an email) and immediately verify its hash.
  const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (lErr || !tokenHash) {
    return c.json({ error: 'Could not start session', code: 'INTERNAL_ERROR' }, 500);
  }
  const { data: sess, error: vErr } = await getAnon().auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (vErr || !sess?.session) {
    return c.json({ error: 'Could not start session', code: 'INTERNAL_ERROR' }, 500);
  }
  return c.json({ session: sess.session });
});

// === Email second factor (staff/manager) =====================================
// These two routes live under /api/auth, which is exempt from the global
// requireAuth + subscription + MFA gate, so they apply requireAuth inline and are
// reachable BEFORE the second factor is satisfied (avoiding a chicken-and-egg).

// --- POST /mfa/send — email a fresh 6-digit code ------------------------------
app.post('/mfa/send', requireAuth, async (c) => {
  const user = c.get('user');
  const { rows } = await pool.query<{ email: string }>('SELECT email FROM users WHERE id=$1', [
    user.id,
  ]);
  const email = rows[0]?.email;
  if (!email) return c.json({ error: 'No email on file', code: 'VALIDATION_ERROR' }, 400);

  const code = genCode();
  await pool.query(
    `INSERT INTO mfa_codes (user_id, code_hash, expires_at, attempts)
     VALUES ($1, $2, NOW() + make_interval(mins => $3), 0)
     ON CONFLICT (user_id) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
           attempts = 0, created_at = NOW()`,
    [user.id, hashCode(code), CODE_TTL_MIN],
  );
  await sendEmail({
    to: email,
    subject: 'Your Sprout sign-in code',
    html: `<p>Your Sprout verification code is <strong style="font-size:20px;letter-spacing:2px">${code}</strong>.</p>
           <p>It expires in ${CODE_TTL_MIN} minutes. If you didn't try to sign in, you can ignore this email.</p>`,
  });
  return c.json({ ok: true });
});

// --- POST /mfa/verify — check the code, mint a 12h proof token -----------------
const verifyMfaSchema = z.object({ code: z.string().min(4).max(8) });

app.post('/mfa/verify', requireAuth, zValidator('json', verifyMfaSchema), async (c) => {
  const user = c.get('user');
  const { code } = c.req.valid('json');
  const { rows } = await pool.query<{ code_hash: string; expires_at: string; attempts: number }>(
    'SELECT code_hash, expires_at, attempts FROM mfa_codes WHERE user_id=$1',
    [user.id],
  );
  const row = rows[0];
  if (!row) return c.json({ error: 'No code requested', code: 'MFA_INVALID' }, 400);
  if (new Date(row.expires_at) < new Date()) {
    await pool.query('DELETE FROM mfa_codes WHERE user_id=$1', [user.id]);
    return c.json({ error: 'Code expired — request a new one', code: 'MFA_INVALID' }, 400);
  }
  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    return c.json({ error: 'Too many attempts — request a new code', code: 'MFA_INVALID' }, 429);
  }
  if (row.code_hash !== hashCode(code)) {
    await pool.query('UPDATE mfa_codes SET attempts = attempts + 1 WHERE user_id=$1', [user.id]);
    return c.json({ error: 'Incorrect code', code: 'MFA_INVALID' }, 400);
  }

  await pool.query('DELETE FROM mfa_codes WHERE user_id=$1', [user.id]);
  const mfaToken = await new SignJWT({ purpose: 'mfa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setExpirationTime('12h')
    .sign(mfaSecret());
  return c.json({ mfaToken });
});

export default app;
