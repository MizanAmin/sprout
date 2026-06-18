import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { dailyLogCreateSchema, dailyLogUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// daily_logs (migration 003). Staff-only: parents read their own via parent.ts,
// which sets the parent role/child_ids so RLS scopes correctly.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'), auditLog);

const COLS: Record<string, string> = {
  childId: 'child_id',
  date: 'date',
  time: 'time',
  type: 'type',
  details: 'details',
  addedBy: 'added_by',
  isShared: 'is_shared',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const date = c.req.query('date');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM daily_logs
       WHERE nursery_id=$1
         AND ($2::int IS NULL OR child_id=$2)
         AND ($3::date IS NULL OR date=$3)
       ORDER BY date DESC, time DESC NULLS LAST, id DESC`,
      [nurseryId, childId ?? null, date ?? null],
    ),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM daily_logs WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Log not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', dailyLogCreateSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO daily_logs (nursery_id, child_id, date, time, type, details, added_by, is_shared)
       VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6,$7,COALESCE($8::boolean, true))
       RETURNING *`,
      [
        nurseryId,
        b.childId,
        b.date ?? null,
        b.time ?? null,
        b.type,
        b.details ?? null,
        b.addedBy ?? name,
        b.isShared ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', dailyLogUpdateSchema), async (c) => {
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
      `UPDATE daily_logs SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Log not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM daily_logs WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Log not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
