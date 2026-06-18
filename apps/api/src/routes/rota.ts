import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Staff rota — structured shifts (rota_shifts, migration 020). One row per shift
// (staff × date) with type, times, room and notes.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const createSchema = z.object({
  staffId: z.number().int().positive(),
  staffName: z.string().min(1),
  date: z.string().min(1),
  type: z.enum(['work', 'holiday', 'sick', 'training', 'off']).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  room: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

const COLS: Record<string, string> = {
  staffId: 'staff_id',
  staffName: 'staff_name',
  date: 'date',
  type: 'type',
  startTime: 'start_time',
  endTime: 'end_time',
  room: 'room',
  notes: 'notes',
};

// GET /?weekStart=YYYY-MM-DD — shifts in that Mon–Sun week (or all if omitted).
app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const weekStart = c.req.query('weekStart');
  const params: unknown[] = [nurseryId];
  let sql = 'SELECT * FROM rota_shifts WHERE nursery_id=$1';
  if (weekStart) {
    params.push(weekStart);
    sql += ` AND date >= $${params.length}::date AND date < ($${params.length}::date + 7)`;
  }
  sql += ' ORDER BY date, staff_name, start_time NULLS LAST, id';
  const { rows } = await withTenant(nurseryId, (client) => client.query(sql, params));
  return c.json(rows);
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO rota_shifts
         (nursery_id, staff_id, staff_name, date, type, start_time, end_time, room, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        nurseryId,
        b.staffId,
        b.staffName,
        b.date,
        b.type ?? 'work',
        b.startTime ?? null,
        b.endTime ?? null,
        b.room ?? '',
        b.notes ?? '',
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
      `UPDATE rota_shifts SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Shift not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM rota_shifts WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Shift not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
