import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Admissions waiting list (the `waiting_list` table, migration 007).
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

const statusEnum = z.enum(['waiting', 'offered', 'enrolled', 'withdrawn']);

const createSchema = z.object({
  childName: z.string().min(1),
  parentName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  desiredStart: z.string().optional(),
  room: z.string().optional(),
  daysRequired: z.string().optional(),
  notes: z.string().optional(),
  position: z.number().int().default(0),
  status: statusEnum.default('waiting'),
});

const updateSchema = createSchema.partial();

const COLS: Record<string, string> = {
  childName: 'child_name',
  parentName: 'parent_name',
  email: 'email',
  phone: 'phone',
  dob: 'dob',
  desiredStart: 'desired_start',
  room: 'room',
  daysRequired: 'days_required',
  notes: 'notes',
  position: 'position',
  status: 'status',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const status = c.req.query('status');
  const params: unknown[] = [nurseryId];
  let sql = 'SELECT * FROM waiting_list WHERE nursery_id=$1';
  if (status) {
    params.push(status);
    sql += ` AND status=$${params.length}`;
  }
  sql += ' ORDER BY position ASC';
  const { rows } = await withTenant(nurseryId, (client) => client.query(sql, params));
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM waiting_list WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Waiting list entry not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO waiting_list
         (nursery_id, child_name, parent_name, email, phone, dob, desired_start, room, days_required, notes, position, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        nurseryId,
        b.childName,
        b.parentName ?? null,
        b.email ?? null,
        b.phone ?? null,
        b.dob ?? null,
        b.desiredStart ?? null,
        b.room ?? null,
        b.daysRequired ?? null,
        b.notes ?? null,
        b.position,
        b.status,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', updateSchema), async (c) => {
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
      `UPDATE waiting_list SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Waiting list entry not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM waiting_list WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Waiting list entry not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
