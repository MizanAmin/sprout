import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { sessionCreateSchema, sessionUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Child session bookings (the `child_sessions` table, migration 005).
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const COLS: Record<string, string> = {
  childId: 'child_id',
  day: 'day',
  sessionType: 'session_type',
  startTime: 'start_time',
  endTime: 'end_time',
  fundedHours: 'funded_hours',
  feeHours: 'fee_hours',
  room: 'room',
  startDate: 'start_date',
  endDate: 'end_date',
  notes: 'notes',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const params: unknown[] = [nurseryId];
  let sql = 'SELECT * FROM child_sessions WHERE nursery_id=$1';
  if (childId) {
    params.push(childId);
    sql += ` AND child_id=$${params.length}`;
  }
  sql += ' ORDER BY start_date DESC, day';
  const { rows } = await withTenant(nurseryId, (client) => client.query(sql, params));
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM child_sessions WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Session not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', sessionCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO child_sessions
         (nursery_id, child_id, day, session_type, start_time, end_time, funded_hours, fee_hours, room, start_date, end_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        nurseryId,
        b.childId,
        b.day,
        b.sessionType,
        b.startTime ?? null,
        b.endTime ?? null,
        b.fundedHours,
        b.feeHours,
        b.room ?? '',
        b.startDate,
        b.endDate ?? null,
        b.notes ?? '',
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', sessionUpdateSchema), async (c) => {
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
      `UPDATE child_sessions SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Session not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM child_sessions WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Session not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
