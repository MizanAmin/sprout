import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { attendanceCreateSchema, attendanceUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// attendance (migration 003). UNIQUE(child_id, date) — POST upserts so the live
// register can sign a child in then out on the same day without duplicating rows.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const COLS: Record<string, string> = {
  status: 'status',
  signIn: 'sign_in',
  signOut: 'sign_out',
  absentReason: 'absent_reason',
  signedInBy: 'signed_in_by',
  collectedBy: 'collected_by',
  attNotes: 'att_notes',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const date = c.req.query('date');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM attendance
       WHERE nursery_id=$1
         AND ($2::int IS NULL OR child_id=$2)
         AND ($3::date IS NULL OR date=$3)
       ORDER BY date DESC, id DESC`,
      [nurseryId, childId ?? null, date ?? null],
    ),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM attendance WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Attendance record not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

// Upsert on (child_id, date): provided fields win; existing sign-in/out is kept
// when the new payload omits them (COALESCE against the existing row).
app.post('/', zValidator('json', attendanceCreateSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO attendance
         (nursery_id, child_id, date, status, sign_in, sign_out, absent_reason, signed_in_by, collected_by, att_notes)
       VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (child_id, date) DO UPDATE SET
         status        = EXCLUDED.status,
         sign_in       = COALESCE(EXCLUDED.sign_in, attendance.sign_in),
         sign_out      = COALESCE(EXCLUDED.sign_out, attendance.sign_out),
         absent_reason = COALESCE(NULLIF(EXCLUDED.absent_reason, ''), attendance.absent_reason),
         signed_in_by  = COALESCE(NULLIF(EXCLUDED.signed_in_by, ''), attendance.signed_in_by),
         collected_by  = COALESCE(NULLIF(EXCLUDED.collected_by, ''), attendance.collected_by),
         att_notes     = COALESCE(NULLIF(EXCLUDED.att_notes, ''), attendance.att_notes)
       RETURNING *`,
      [
        nurseryId,
        b.childId,
        b.date ?? null,
        b.status ?? 'present',
        b.signIn ?? null,
        b.signOut ?? null,
        b.absentReason ?? '',
        b.signedInBy ?? name,
        b.collectedBy ?? '',
        b.attNotes ?? '',
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', attendanceUpdateSchema), async (c) => {
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
      `UPDATE attendance SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Attendance record not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM attendance WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Attendance record not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
