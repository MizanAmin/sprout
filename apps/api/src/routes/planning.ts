import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// planning (migration 004).
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const createSchema = z.object({
  title: z.string().min(1),
  day: z.string().optional(),
  time: z.string().optional(),
  category: z.string().optional(),
  room: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
});

const updateSchema = createSchema.partial();

const COLS: Record<string, string> = {
  title: 'title',
  day: 'day',
  time: 'time',
  category: 'category',
  room: 'room',
  description: 'description',
  date: 'date',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const day = c.req.query('day');
  const room = c.req.query('room');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM planning
       WHERE nursery_id=$1
         AND ($2::text IS NULL OR day=$2)
         AND ($3::text IS NULL OR room=$3)
       ORDER BY id`,
      [nurseryId, day ?? null, room ?? null],
    ),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM planning WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Plan not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO planning (nursery_id, title, day, time, category, room, description, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        nurseryId,
        b.title,
        b.day ?? 'Mon',
        b.time ?? null,
        b.category ?? 'Other',
        b.room ?? 'All',
        b.description ?? null,
        b.date ?? null,
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
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE planning SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Plan not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM planning WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Plan not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
