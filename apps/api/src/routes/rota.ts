import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Staff rota (the `rota` table, migration 005). One row per
// (nursery, staff_name, week_start).
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const createSchema = z.object({
  staffName: z.string().min(1),
  weekStart: z.string().min(1),
  mon: z.string().optional(),
  tue: z.string().optional(),
  wed: z.string().optional(),
  thu: z.string().optional(),
  fri: z.string().optional(),
  sat: z.string().optional(),
  sun: z.string().optional(),
});

const updateSchema = createSchema.partial();

const COLS: Record<string, string> = {
  staffName: 'staff_name',
  weekStart: 'week_start',
  mon: 'mon',
  tue: 'tue',
  wed: 'wed',
  thu: 'thu',
  fri: 'fri',
  sat: 'sat',
  sun: 'sun',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const weekStart = c.req.query('weekStart');
  const params: unknown[] = [nurseryId];
  let sql = 'SELECT * FROM rota WHERE nursery_id=$1';
  if (weekStart) {
    params.push(weekStart);
    sql += ` AND week_start=$${params.length}`;
  }
  sql += ' ORDER BY week_start DESC, staff_name';
  const { rows } = await withTenant(nurseryId, (client) => client.query(sql, params));
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM rota WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Rota entry not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

// Upsert on (nursery_id, staff_name, week_start).
app.post('/', zValidator('json', createSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO rota (nursery_id, staff_name, week_start, mon, tue, wed, thu, fri, sat, sun)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (nursery_id, staff_name, week_start)
       DO UPDATE SET mon=EXCLUDED.mon, tue=EXCLUDED.tue, wed=EXCLUDED.wed, thu=EXCLUDED.thu, fri=EXCLUDED.fri, sat=EXCLUDED.sat, sun=EXCLUDED.sun
       RETURNING *`,
      [
        nurseryId,
        b.staffName,
        b.weekStart,
        b.mon ?? '',
        b.tue ?? '',
        b.wed ?? '',
        b.thu ?? '',
        b.fri ?? '',
        b.sat ?? '',
        b.sun ?? '',
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
      `UPDATE rota SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Rota entry not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM rota WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Rota entry not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
