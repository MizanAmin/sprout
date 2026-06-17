import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { userCreateSchema, userUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant, supabaseAdmin } from '../db';
import type { HonoEnv } from '../types';

// Login accounts (the `users` table mirrors auth.users). All mutations are
// manager-only and span two systems: Supabase Auth (the credential + custom
// claims in user_metadata) and the public.users row (RLS-scoped profile).
// users.id is a FK to auth.users(id) ON DELETE CASCADE — so the auth user is the
// source of truth: create it first, delete it to cascade the profile away.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth);

app.get('/', requireRole('manager'), async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT id, nursery_id, name, email, role, created_at FROM users WHERE nursery_id=$1 ORDER BY name', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.get('/:id', requireRole('manager'), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT id, nursery_id, name, email, role, created_at FROM users WHERE id=$1 AND nursery_id=$2', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'User not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', requireRole('manager'), zValidator('json', userCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const { name, email, role } = c.req.valid('json');

  // 1) Create the auth user (sends an invite email) with custom claims.
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { nursery_id: nurseryId, role, name },
  });
  if (error || !data?.user) {
    return c.json({ error: error?.message ?? 'Failed to create user', code: 'INTERNAL_ERROR' }, 500);
  }

  // 2) Mirror into public.users (RLS-scoped via withTenant).
  try {
    const { rows } = await withTenant(nurseryId, (client) =>
      client.query(
        'INSERT INTO users (id, nursery_id, name, email, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, nursery_id, name, email, role, created_at',
        [data.user.id, nurseryId, name, email, role],
      ),
    );
    return c.json(rows[0], 201);
  } catch (err) {
    // Roll back the orphaned auth user so a retry can reuse the email.
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw err;
  }
});

// --- POST /parent — invite a parent login linked to one or more children ------
// Mirrors register-nursery's parent shape: a Supabase auth user with role
// 'parent' + child_ids in the JWT claims, a public.users row, and user_children
// links. The parent signs in via the parent app's email OTP.
const parentInviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  childIds: z.array(z.number().int().positive()).min(1),
});

app.post('/parent', requireRole('manager'), zValidator('json', parentInviteSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const { name, email, childIds } = c.req.valid('json');

  // 1) Validate every child belongs to this nursery (RLS-scoped).
  const owned = await withTenant(nurseryId, (client) =>
    client.query<{ id: number }>(
      'SELECT id FROM children WHERE nursery_id=$1 AND id = ANY($2::int[])',
      [nurseryId, childIds],
    ),
  );
  if (owned.rows.length !== childIds.length) {
    return c.json({ error: 'One or more children not found', code: 'VALIDATION_ERROR' }, 422);
  }

  // 2) Create the auth user (email pre-confirmed; parent logs in via OTP) with
  //    parent claims.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nursery_id: nurseryId, role: 'parent', name, child_ids: childIds },
  });
  if (error || !data?.user) {
    return c.json({ error: error?.message ?? 'Failed to create parent', code: 'INTERNAL_ERROR' }, 500);
  }
  const userId = data.user.id;

  // 3) Mirror into public.users + link children, rolling back the auth user on failure.
  try {
    const { rows } = await withTenant(nurseryId, async (client) => {
      const r = await client.query(
        `INSERT INTO users (id, nursery_id, name, email, role) VALUES ($1,$2,$3,$4,'parent')
         RETURNING id, nursery_id, name, email, role, created_at`,
        [userId, nurseryId, name, email],
      );
      for (const childId of childIds) {
        await client.query(
          `INSERT INTO user_children (nursery_id, user_id, child_id) VALUES ($1,$2,$3)
           ON CONFLICT (user_id, child_id) DO NOTHING`,
          [nurseryId, userId, childId],
        );
      }
      return r;
    });
    return c.json(rows[0], 201);
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    throw err;
  }
});

app.patch('/:id', requireRole('manager'), zValidator('json', userUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json');
  if (b.name === undefined && b.role === undefined) {
    return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  }

  // Confirm the target belongs to this nursery before touching auth (RLS-scoped).
  const existing = await withTenant(nurseryId, (client) =>
    client.query('SELECT id FROM users WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!existing.rows[0]) return c.json({ error: 'User not found', code: 'NOT_FOUND' }, 404);

  // Update auth claims — merge with existing metadata so nursery_id/child_ids survive.
  const { data: current, error: getErr } = await supabaseAdmin.auth.admin.getUserById(id);
  if (getErr || !current?.user) {
    return c.json({ error: getErr?.message ?? 'Auth user not found', code: 'INTERNAL_ERROR' }, 500);
  }
  const meta = { ...current.user.user_metadata } as Record<string, unknown>;
  if (b.name !== undefined) meta.name = b.name;
  if (b.role !== undefined) meta.role = b.role;
  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: meta });
  if (updErr) return c.json({ error: updErr.message, code: 'INTERNAL_ERROR' }, 500);

  // Update the profile row.
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (b.name !== undefined) {
    sets.push(`name=$${i++}`);
    vals.push(b.name);
  }
  if (b.role !== undefined) {
    sets.push(`role=$${i++}`);
    vals.push(b.role);
  }
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING id, nursery_id, name, email, role, created_at`,
      vals,
    ),
  );
  return c.json(rows[0]);
});

app.delete('/:id', requireRole('manager'), async (c) => {
  const { nurseryId, id: callerId } = c.get('user');
  const id = c.req.param('id');
  if (id === callerId) {
    return c.json({ error: 'You cannot delete your own account', code: 'FORBIDDEN' }, 403);
  }

  // Confirm same-nursery before deleting via auth (RLS-scoped).
  const existing = await withTenant(nurseryId, (client) =>
    client.query('SELECT id FROM users WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!existing.rows[0]) return c.json({ error: 'User not found', code: 'NOT_FOUND' }, 404);

  // Deleting the auth user cascades to public.users (FK ON DELETE CASCADE).
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return c.json({ error: error.message, code: 'INTERNAL_ERROR' }, 500);
  return c.json({ ok: true });
});

export default app;
