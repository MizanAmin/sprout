import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// calendar_events (migration 003).
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const createSchema = z.object({
  title: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
  allDay: z.boolean().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  createdBy: z.string().optional(),
});

const updateSchema = createSchema.partial();

const COLS: Record<string, string> = {
  title: 'title',
  startDate: 'start_date',
  endDate: 'end_date',
  allDay: 'all_day',
  color: 'color',
  description: 'description',
  createdBy: 'created_by',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM calendar_events
       WHERE nursery_id=$1
         AND ($2::date IS NULL OR start_date >= $2)
         AND ($3::date IS NULL OR start_date <= $3)
       ORDER BY start_date, id`,
      [nurseryId, from ?? null, to ?? null],
    ),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM calendar_events WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Event not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO calendar_events
         (nursery_id, title, start_date, end_date, all_day, color, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        nurseryId,
        b.title,
        b.startDate,
        b.endDate ?? null,
        b.allDay ?? true,
        b.color ?? '#4f8ef7',
        b.description ?? null,
        b.createdBy ?? name,
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
      `UPDATE calendar_events SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Event not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM calendar_events WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Event not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
