import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { supabaseAdmin, pool } from '../db';
import { adminAuth } from '../middleware/adminAuth';

// Platform super-admin (cross-tenant) routes. NOT tenant-scoped: these run as the
// raw pool (no withTenant / RLS) and are guarded ONLY by the X-Admin-Key shared
// secret (adminAuth), separate from the per-nursery Supabase JWT. Mounted under
// /api/admin and exempted from requireAuth / requireActiveSubscription in index.ts.
const app = new Hono();

// Every admin route requires the shared secret.
app.use('*', adminAuth);

const PLANS = ['seedling', 'blossom', 'grove', 'forest', 'cancelled'] as const;

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

export default app;
