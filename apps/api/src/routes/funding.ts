import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Funding Reconciliation (manager only): funding_periods + funding_claims
// (migration 006). Per-child claimed vs expected funded hours per period.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

// ---- Periods ----

const periodCreateSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});
const periodUpdateSchema = periodCreateSchema.partial();
const PERIOD_COLS: Record<string, string> = {
  label: 'label',
  startDate: 'start_date',
  endDate: 'end_date',
};

app.get('/periods', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM funding_periods WHERE nursery_id=$1 ORDER BY start_date DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.post('/periods', zValidator('json', periodCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO funding_periods (nursery_id, label, start_date, end_date)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [nurseryId, b.label, b.startDate, b.endDate],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/periods/:id', zValidator('json', periodUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = PERIOD_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE funding_periods SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Funding period not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/periods/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM funding_periods WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Funding period not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Claims ----

const claimCreateSchema = z.object({
  fundingPeriodId: z.number().int().positive(),
  childId: z.number().int().positive().optional(),
  childName: z.string().optional(),
  claimedHours: z.number().nonnegative().optional(),
  expectedHours: z.number().nonnegative().optional(),
  status: z.string().optional(),
  claimType: z.string().optional(),
  receivedDate: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  amount: z.number().optional(),
});
const claimUpdateSchema = claimCreateSchema.partial();
const CLAIM_COLS: Record<string, string> = {
  fundingPeriodId: 'funding_period_id',
  childId: 'child_id',
  childName: 'child_name',
  claimedHours: 'claimed_hours',
  expectedHours: 'expected_hours',
  status: 'status',
  claimType: 'claim_type',
  receivedDate: 'received_date',
  reference: 'reference',
  notes: 'notes',
  amount: 'amount',
};

app.get('/claims', async (c) => {
  const { nurseryId } = c.get('user');
  const periodId = c.req.query('periodId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM funding_claims
       WHERE nursery_id=$1 AND ($2::int IS NULL OR funding_period_id=$2)
       ORDER BY child_name`,
      [nurseryId, periodId ?? null],
    ),
  );
  return c.json(rows);
});

app.post('/claims', zValidator('json', claimCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO funding_claims
         (nursery_id, funding_period_id, child_id, child_name, claimed_hours, expected_hours, status,
          claim_type, received_date, reference, notes, amount)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'draft'),$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        nurseryId,
        b.fundingPeriodId,
        b.childId ?? null,
        b.childName ?? '',
        b.claimedHours ?? 0,
        b.expectedHours ?? 0,
        b.status ?? null,
        b.claimType ?? null,
        b.receivedDate ?? null,
        b.reference ?? null,
        b.notes ?? null,
        b.amount ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/claims/:id', zValidator('json', claimUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = CLAIM_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE funding_claims SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Funding claim not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/claims/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM funding_claims WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Funding claim not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
