import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { supabaseAdmin, pool } from '../db';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin';

// Platform super-admin (cross-tenant) routes. NOT tenant-scoped: these run as the
// raw pool (no withTenant / RLS) and are guarded by a real Supabase login plus the
// ADMIN_EMAILS allowlist (requirePlatformAdmin), separate from per-nursery role
// checks. Mounted under /api/admin and exempted from requireAuth /
// requireActiveSubscription in index.ts.
const app = new Hono();

// Every admin route requires an allowlisted platform-admin login.
app.use('*', requirePlatformAdmin);

const PLANS = ['seedling', 'blossom', 'grove', 'forest', 'cancelled'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- GET /nurseries -----------------------------------------------------------
// List every tenant with a user count, newest first.
app.get('/nurseries', async (c) => {
  const { rows } = await pool.query(
    `SELECT n.id, n.name, n.email, n.plan, n.status, n.trial_ends_at, n.created_at,
            n.stripe_subscription_id,
            COALESCE(u.cnt, 0)::int AS user_count
       FROM nurseries n
       LEFT JOIN (SELECT nursery_id, COUNT(*) AS cnt FROM users GROUP BY nursery_id) u
         ON u.nursery_id = n.id
      ORDER BY n.created_at DESC NULLS LAST, n.id DESC`,
  );
  return c.json({ nurseries: rows });
});

// --- PATCH /nurseries/:id -----------------------------------------------------
// Change plan, suspend/reactivate (status), and/or set the trial end date.
const patchSchema = z
  .object({
    plan: z.enum(PLANS).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    // ISO datetime, or null to clear the trial.
    trialEndsAt: z.string().datetime().nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No changes provided' });

app.patch('/nurseries/:id', zValidator('json', patchSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Invalid id', code: 'VALIDATION_ERROR' }, 400);
  }
  const body = c.req.valid('json');

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (body.plan !== undefined) {
    sets.push(`plan=$${i++}`);
    vals.push(body.plan);
  }
  if (body.status !== undefined) {
    sets.push(`status=$${i++}`);
    vals.push(body.status);
  }
  if (body.trialEndsAt !== undefined) {
    sets.push(`trial_ends_at=$${i++}`);
    vals.push(body.trialEndsAt);
  }
  vals.push(id);

  const { rows } = await pool.query(
    `UPDATE nurseries SET ${sets.join(', ')} WHERE id=$${i}
     RETURNING id, name, plan, status, trial_ends_at`,
    vals,
  );
  if (!rows.length) return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404);

  // Keep each user's JWT `plan` claim in sync so client-side plan gating matches
  // the authoritative nurseries.plan (the change takes effect on next session
  // refresh). Best-effort — a failure here doesn't undo the plan change.
  if (body.plan !== undefined) {
    const { rows: us } = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE nursery_id=$1',
      [id],
    );
    for (const u of us) {
      await supabaseAdmin.auth.admin
        .updateUserById(u.id, { user_metadata: { plan: body.plan } })
        .catch(() => {});
    }
  }

  return c.json({ nursery: rows[0] });
});

// --- POST /nurseries ----------------------------------------------------------
// Provision a new nursery and invite its first manager by email (magic link).
const createSchema = z.object({
  nurseryName: z.string().min(1),
  managerName: z.string().min(1),
  email: z.string().email(),
  plan: z.enum(PLANS).default('seedling'),
  trialDays: z.number().int().min(0).max(365).default(14),
});

app.post('/nurseries', zValidator('json', createSchema), async (c) => {
  const { nurseryName, managerName, email, plan, trialDays } = c.req.valid('json');

  // 1) Create the nursery row.
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO nurseries (name, email, plan, trial_ends_at)
     VALUES ($1, $2, $3, NOW() + make_interval(days => $4::int))
     RETURNING id`,
    [nurseryName, email, plan, trialDays],
  );
  const nurseryId = rows[0].id;

  // 2) Invite the manager by email with their custom claims pre-set.
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { nursery_id: nurseryId, role: 'manager', name: managerName, child_ids: [], plan },
    redirectTo: process.env.STAFF_APP_URL ? `${process.env.STAFF_APP_URL}/login` : undefined,
  });
  if (error || !data?.user) {
    await pool.query('DELETE FROM nurseries WHERE id=$1', [nurseryId]).catch(() => {});
    return c.json({ error: error?.message ?? 'Invite failed', code: 'INTERNAL_ERROR' }, 500);
  }

  // 3) Mirror into public.users.
  try {
    await pool.query(
      'INSERT INTO users (id, nursery_id, name, email, role) VALUES ($1,$2,$3,$4,$5)',
      [data.user.id, nurseryId, managerName, email, 'manager'],
    );
  } catch {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => {});
    await pool.query('DELETE FROM nurseries WHERE id=$1', [nurseryId]).catch(() => {});
    return c.json({ error: 'Failed to create nursery', code: 'INTERNAL_ERROR' }, 500);
  }

  return c.json({ nurseryId, userId: data.user.id }, 201);
});

// === Per-nursery drill-down: user management ================================

// --- GET /nurseries/:id/users -------------------------------------------------
app.get('/nurseries/:id/users', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Invalid id', code: 'VALIDATION_ERROR' }, 400);
  }
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at,
            COALESCE(ch.cnt, 0)::int AS child_count
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM user_children GROUP BY user_id) ch
         ON ch.user_id = u.id
      WHERE u.nursery_id=$1
      ORDER BY CASE u.role WHEN 'manager' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END, u.name`,
    [id],
  );
  return c.json({ users: rows });
});

// --- POST /nurseries/:id/users — invite a staff/manager -----------------------
const inviteUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['manager', 'staff']),
});

app.post('/nurseries/:id/users', zValidator('json', inviteUserSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Invalid id', code: 'VALIDATION_ERROR' }, 400);
  }
  const { rows: nr } = await pool.query<{ plan: string }>(
    'SELECT plan FROM nurseries WHERE id=$1',
    [id],
  );
  if (!nr.length) return c.json({ error: 'Nursery not found', code: 'NOT_FOUND' }, 404);

  const { name, email, role } = c.req.valid('json');
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { nursery_id: id, role, name, child_ids: [], plan: nr[0].plan },
    redirectTo: process.env.STAFF_APP_URL ? `${process.env.STAFF_APP_URL}/login` : undefined,
  });
  if (error || !data?.user) {
    return c.json({ error: error?.message ?? 'Invite failed', code: 'INTERNAL_ERROR' }, 500);
  }
  try {
    await pool.query(
      'INSERT INTO users (id, nursery_id, name, email, role) VALUES ($1,$2,$3,$4,$5)',
      [data.user.id, id, name, email, role],
    );
  } catch {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => {});
    return c.json({ error: 'Failed to add user', code: 'INTERNAL_ERROR' }, 500);
  }
  return c.json({ userId: data.user.id }, 201);
});

// --- PATCH /nurseries/:id/users/:userId — change role -------------------------
const roleSchema = z.object({ role: z.enum(['manager', 'staff']) });

app.patch('/nurseries/:id/users/:userId', zValidator('json', roleSchema), async (c) => {
  const id = Number(c.req.param('id'));
  const userId = c.req.param('userId');
  if (!Number.isInteger(id) || !UUID_RE.test(userId)) {
    return c.json({ error: 'Invalid id', code: 'VALIDATION_ERROR' }, 400);
  }
  const { role } = c.req.valid('json');
  const { rows } = await pool.query(
    'UPDATE users SET role=$1 WHERE id=$2 AND nursery_id=$3 RETURNING id, role',
    [role, userId, id],
  );
  if (!rows.length) return c.json({ error: 'User not found', code: 'NOT_FOUND' }, 404);
  // Mirror into the JWT role claim (takes effect on the user's next session).
  await supabaseAdmin.auth.admin
    .updateUserById(userId, { user_metadata: { role } })
    .catch(() => {});
  return c.json({ user: rows[0] });
});

// --- DELETE /nurseries/:id/users/:userId -------------------------------------
app.delete('/nurseries/:id/users/:userId', async (c) => {
  const id = Number(c.req.param('id'));
  const userId = c.req.param('userId');
  if (!Number.isInteger(id) || !UUID_RE.test(userId)) {
    return c.json({ error: 'Invalid id', code: 'VALIDATION_ERROR' }, 400);
  }
  // Confirm the user belongs to this nursery before deleting.
  const { rows } = await pool.query('SELECT id FROM users WHERE id=$1 AND nursery_id=$2', [
    userId,
    id,
  ]);
  if (!rows.length) return c.json({ error: 'User not found', code: 'NOT_FOUND' }, 404);
  // Deleting the auth user cascades to public.users + user_children (FK ON DELETE CASCADE).
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return c.json({ error: error.message, code: 'INTERNAL_ERROR' }, 500);
  return c.json({ ok: true });
});

export default app;
