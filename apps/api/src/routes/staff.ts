import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { staffCreateSchema, staffUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// HR records (the `staff` table, migration 002) — distinct from login accounts
// in `users` (see users.ts).
const app = new Hono<HonoEnv>();
app.use('*', requireAuth);

const COLS: Record<string, string> = {
  name: 'name',
  role: 'role',
  room: 'room',
  qualification: 'qualification',
  phone: 'phone',
  startDate: 'start_date',
  status: 'status',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM staff WHERE nursery_id=$1 ORDER BY name', [nurseryId]),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM staff WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Staff member not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', requireRole('manager'), zValidator('json', staffCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO staff (nursery_id, name, role, room, qualification, phone, start_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        nurseryId,
        b.name,
        b.role ?? null,
        b.room ?? null,
        b.qualification ?? null,
        b.phone ?? null,
        b.startDate ?? null,
        b.status ?? 'Active',
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', requireRole('manager'), zValidator('json', staffUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) {
    return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  }
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE staff SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Staff member not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', requireRole('manager'), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM staff WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Staff member not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
