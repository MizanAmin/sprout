import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Parent-submitted requests awaiting staff approval (migration 005):
//   /bookings* -> booking_requests
//   /holidays* -> holiday_credit_requests
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const decisionEnum = z.enum(['pending', 'approved', 'declined']);

// ---- booking_requests ----

const bookingCreateSchema = z.object({
  childId: z.number().int().positive().optional(),
  childName: z.string().optional(),
  weekStart: z.string().optional(),
  day: z.string().optional(),
  sessionType: z.string().optional(),
  room: z.string().optional(),
  parentNote: z.string().optional(),
  capacityNote: z.string().optional(),
  status: decisionEnum.default('pending'),
});

const bookingUpdateSchema = z.object({
  childName: z.string().optional(),
  weekStart: z.string().optional(),
  day: z.string().optional(),
  sessionType: z.string().optional(),
  room: z.string().optional(),
  parentNote: z.string().optional(),
  capacityNote: z.string().optional(),
  status: decisionEnum.optional(),
});

const BOOKING_COLS: Record<string, string> = {
  childName: 'child_name',
  weekStart: 'week_start',
  day: 'day',
  sessionType: 'session_type',
  room: 'room',
  parentNote: 'parent_note',
  capacityNote: 'capacity_note',
  status: 'status',
};

app.get('/bookings', async (c) => {
  const { nurseryId } = c.get('user');
  const status = c.req.query('status');
  const params: unknown[] = [nurseryId];
  let sql = 'SELECT * FROM booking_requests WHERE nursery_id=$1';
  if (status) {
    params.push(status);
    sql += ` AND status=$${params.length}`;
  }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await withTenant(nurseryId, (client) => client.query(sql, params));
  return c.json(rows);
});

app.get('/bookings/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM booking_requests WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Booking request not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/bookings', zValidator('json', bookingCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO booking_requests
         (nursery_id, child_id, child_name, week_start, day, session_type, room, parent_note, capacity_note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        nurseryId,
        b.childId ?? null,
        b.childName ?? '',
        b.weekStart ?? null,
        b.day ?? '',
        b.sessionType ?? '',
        b.room ?? '',
        b.parentNote ?? '',
        b.capacityNote ?? '',
        b.status,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/bookings/:id', zValidator('json', bookingUpdateSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = BOOKING_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  // Record who decided when the status changes.
  if (b.status !== undefined) {
    sets.push(`decided_by=$${i++}`);
    vals.push(name);
    sets.push('decided_at=NOW()');
  }
  if (sets.length === 0) {
    return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  }
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE booking_requests SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Booking request not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/bookings/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM booking_requests WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Booking request not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- holiday_credit_requests ----

const holidayCreateSchema = z.object({
  childId: z.number().int().positive().optional(),
  childName: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
  status: decisionEnum.default('pending'),
});

const holidayUpdateSchema = z.object({
  childName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().optional(),
  status: decisionEnum.optional(),
});

const HOLIDAY_COLS: Record<string, string> = {
  childName: 'child_name',
  startDate: 'start_date',
  endDate: 'end_date',
  reason: 'reason',
  status: 'status',
};

app.get('/holidays', async (c) => {
  const { nurseryId } = c.get('user');
  const status = c.req.query('status');
  const params: unknown[] = [nurseryId];
  let sql = 'SELECT * FROM holiday_credit_requests WHERE nursery_id=$1';
  if (status) {
    params.push(status);
    sql += ` AND status=$${params.length}`;
  }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await withTenant(nurseryId, (client) => client.query(sql, params));
  return c.json(rows);
});

app.get('/holidays/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM holiday_credit_requests WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Holiday credit request not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/holidays', zValidator('json', holidayCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO holiday_credit_requests
         (nursery_id, child_id, child_name, start_date, end_date, reason, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        nurseryId,
        b.childId ?? null,
        b.childName ?? '',
        b.startDate,
        b.endDate,
        b.reason ?? '',
        b.status,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/holidays/:id', zValidator('json', holidayUpdateSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = HOLIDAY_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  // Record who decided when the status changes.
  if (b.status !== undefined) {
    sets.push(`decided_by=$${i++}`);
    vals.push(name);
    sets.push('decided_at=NOW()');
  }
  if (sets.length === 0) {
    return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  }
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE holiday_credit_requests SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Holiday credit request not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/holidays/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM holiday_credit_requests WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Holiday credit request not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
