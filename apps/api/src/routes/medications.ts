import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { medicationCreateSchema, medicationUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// medications (migration 003) — administration records.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'), auditLog);

const COLS: Record<string, string> = {
  childId: 'child_id',
  medicationName: 'medication_name',
  dose: 'dose',
  doseGiven: 'dose_given',
  frequency: 'frequency',
  route: 'route',
  prescribedBy: 'prescribed_by',
  startDate: 'start_date',
  endDate: 'end_date',
  givenBy: 'given_by',
  witnessBy: 'witness_by',
  timeGiven: 'time_given',
  refusedReason: 'refused_reason',
  notes: 'notes',
  status: 'status',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM medications
       WHERE nursery_id=$1 AND ($2::int IS NULL OR child_id=$2)
       ORDER BY created_at DESC`,
      [nurseryId, childId ?? null],
    ),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM medications WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Medication record not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', medicationCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO medications
         (nursery_id, child_id, medication_name, dose, dose_given, frequency, route, prescribed_by,
          start_date, end_date, given_by, witness_by, time_given, refused_reason, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,COALESCE($16,'active'))
       RETURNING *`,
      [
        nurseryId,
        b.childId,
        b.medicationName,
        b.dose ?? '',
        b.doseGiven ?? '',
        b.frequency ?? '',
        b.route ?? '',
        b.prescribedBy ?? '',
        b.startDate ?? null,
        b.endDate ?? null,
        b.givenBy ?? '',
        b.witnessBy ?? '',
        b.timeGiven ?? null,
        b.refusedReason ?? '',
        b.notes ?? '',
        b.status ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', medicationUpdateSchema), async (c) => {
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
      `UPDATE medications SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Medication record not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM medications WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Medication record not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
