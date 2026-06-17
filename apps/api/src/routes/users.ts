import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
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
