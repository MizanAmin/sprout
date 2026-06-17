import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Monitoring is the daily check grid (children × categories). There is NO
// dedicated `monitoring` table — each grid "mark" is a row in the daily_logs
// table (migration 003). The frontend builds the grid from these rows.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

// daily_logs.type CHECK constraint allows exactly these values.
const createSchema = z.object({
  childId: z.number().int(),
  type: z.enum(['meal', 'sleep', 'nappy', 'mood', 'activity', 'note']),
  details: z.string().optional(),
  time: z.string().optional(),
  // Optional YYYY-MM-DD; defaults to CURRENT_DATE so historic checks can be logged.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// GET /?date= -> daily_logs rows for that date (default today) for the nursery,
// so the frontend can assemble the monitoring grid.
app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const date = c.req.query('date');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM daily_logs
       WHERE nursery_id=$1
         AND date = COALESCE($2::date, CURRENT_DATE)
       ORDER BY child_id, time NULLS LAST, id`,
      [nurseryId, date ?? null],
    ),
  );
  return c.json(rows);
});

// POST / -> insert a daily_logs "mark" for the given date (defaults to today).
app.post('/', zValidator('json', createSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO daily_logs (nursery_id, child_id, date, time, type, details, added_by)
       VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6,$7)
       RETURNING *`,
      [nurseryId, b.childId, b.date ?? null, b.time ?? null, b.type, b.details ?? null, name],
    ),
  );
  return c.json(rows[0], 201);
});

// DELETE /:id -> remove a daily_logs mark.
app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM daily_logs WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Mark not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
