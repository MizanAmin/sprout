import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { invoiceCreateSchema, lineItemSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import { expandPatternsForRange } from '../services/sessionPatterns';
import { ageBandForDob, ratesForBand, type NurseryRates } from '../services/ageBands';
import type { HonoEnv } from '../types';

// invoices (migration 006). Manager only. Total is always derived from line_items.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

const sumLineItems = (items: Array<{ amount: number }>) =>
  items.reduce((s, l) => s + l.amount, 0);

const invoiceUpdateSchema = z.object({
  status: z.enum(['Pending', 'Paid', 'Overdue', 'Cancelled']).optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const status = c.req.query('status');
  const childId = c.req.query('childId');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const search = c.req.query('search');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM invoices
       WHERE nursery_id=$1
         AND ($2::text IS NULL OR status=$2)
         AND ($3::int  IS NULL OR child_id=$3)
         AND ($4::date IS NULL OR created_at::date >= $4)
         AND ($5::date IS NULL OR created_at::date <= $5)
         AND ($6::text IS NULL OR child_name ILIKE '%'||$6||'%' OR invoice_ref ILIKE '%'||$6||'%')
       ORDER BY created_at DESC`,
      [nurseryId, status ?? null, childId ?? null, from ?? null, to ?? null, search ?? null],
    ),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM invoices WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', invoiceCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const amount = sumLineItems(b.lineItems);
  const row = await withTenant(nurseryId, async (client) => {
    const child = await client.query('SELECT name FROM children WHERE id=$1 AND nursery_id=$2', [
      b.childId,
      nurseryId,
    ]);
    if (!child.rows[0]) return null; // child not in this nursery
    const childName = child.rows[0].name as string;
    const res = await client.query(
      `INSERT INTO invoices
         (nursery_id, child_id, child_name, invoice_ref, period, amount, status, due_date, line_items, notes)
       VALUES ($1,$2,$3,$4,$5,$6,'Pending',$7,$8,$9)
       RETURNING *`,
      [
        nurseryId,
        b.childId,
        childName,
        `INV-${nurseryId}-${b.childId}-${b.period}`,
        b.period,
        amount,
        b.dueDate ?? null,
        JSON.stringify(b.lineItems),
        b.notes ?? '',
      ],
    );
    return res.rows[0];
  });
  if (!row) return c.json({ error: 'Child not found', code: 'NOT_FOUND' }, 404);
  return c.json(row, 201);
});

app.patch('/:id', zValidator('json', invoiceUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json');
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (b.status !== undefined) {
    sets.push(`status=$${i++}`);
    vals.push(b.status);
  }
  if (b.dueDate !== undefined) {
    sets.push(`due_date=$${i++}`);
    vals.push(b.dueDate);
  }
  if (b.notes !== undefined) {
    sets.push(`notes=$${i++}`);
    vals.push(b.notes);
  }
  if (b.lineItems !== undefined) {
    sets.push(`line_items=$${i++}`);
    vals.push(JSON.stringify(b.lineItems));
    sets.push(`amount=$${i++}`); // keep total derived from line items
    vals.push(sumLineItems(b.lineItems));
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE invoices SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

// Mark an invoice fully paid and record a manual payment row.
app.post('/:id/mark-paid', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, async (client) => {
    const upd = await client.query(
      `UPDATE invoices SET status='Paid', amount_paid=amount
       WHERE id=$1 AND nursery_id=$2 RETURNING *`,
      [id, nurseryId],
    );
    if (!upd.rows[0]) return upd;
    const inv = upd.rows[0];
    await client.query(
      `INSERT INTO payments (nursery_id, invoice_id, child_id, amount, method, reference)
       VALUES ($1,$2,$3,$4,'manual','mark-paid')`,
      [nurseryId, inv.id, inv.child_id, inv.amount],
    );
    return upd;
  });
  if (!rows[0]) return c.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

// Stamp a reminder as sent. The actual email send happens via services/email
// (invoiceReminders job); this endpoint backs the manual "Send Reminder" button.
app.post('/:id/send-reminder', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE invoices SET reminder_sent_at=NOW(), reminder_count=reminder_count+1
       WHERE id=$1 AND nursery_id=$2 RETURNING *`,
      [id, nurseryId],
    ),
  );
  if (!rows[0]) return c.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, 404);
  // TODO: send the reminder email via services/email + log to reminder_log.
  return c.json(rows[0]);
});

// Monthly auto-invoicing, manager-triggered. ?preview=1 returns the computed
// totals without writing; otherwise it inserts invoices, skipping any child that
// already has one for this period (idempotent, mirrors the invoiceGenerator job).
app.post('/generate', async (c) => {
  const { nurseryId } = c.get('user');
  const preview = c.req.query('preview') === '1' || c.req.query('preview') === 'true';
  const today = new Date();
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const periodStart = `${period}-01`;
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const result = await withTenant(nurseryId, async (client) => {
    const nurseryRes = await client.query('SELECT * FROM nurseries WHERE id=$1', [nurseryId]);
    const nursery = nurseryRes.rows[0] as NurseryRates & Record<string, unknown>;
    const children = await client.query(
      `SELECT id, name, dob FROM children WHERE nursery_id=$1 AND status='Active' ORDER BY name`,
      [nurseryId],
    );

    const generated: Array<{ childId: number; childName: string; amount: number; skipped: boolean }> = [];
    for (const child of children.rows) {
      const existing = await client.query(
        'SELECT id FROM invoices WHERE nursery_id=$1 AND child_id=$2 AND period=$3 LIMIT 1',
        [nurseryId, child.id, period],
      );
      if (existing.rows.length > 0) {
        generated.push({ childId: child.id, childName: child.name, amount: 0, skipped: true });
        continue;
      }
      const sessions = await client.query(
        'SELECT day, start_date, end_date, fee_hours, funded_hours FROM child_sessions WHERE nursery_id=$1 AND child_id=$2',
        [nurseryId, child.id],
      );
      const { feeHours } = expandPatternsForRange(sessions.rows, periodStart, periodEnd);
      const { feeRate } = ratesForBand(nursery, ageBandForDob(child.dob));
      const amount = Number((feeHours * feeRate).toFixed(2));
      if (amount <= 0) continue;

      if (!preview) {
        await client.query(
          `INSERT INTO invoices (nursery_id, child_id, child_name, invoice_ref, period, amount, status, due_date, line_items)
           VALUES ($1,$2,$3,$4,$5,$6,'Pending',$7,$8)`,
          [
            nurseryId,
            child.id,
            child.name,
            `INV-${nurseryId}-${child.id}-${period}`,
            period,
            amount,
            periodEnd,
            JSON.stringify([{ description: `${period} sessions`, hours: feeHours, rate: feeRate, amount }]),
          ],
        );
      }
      generated.push({ childId: child.id, childName: child.name, amount, skipped: false });
    }
    return generated;
  });

  const created = result.filter((r) => !r.skipped);
  return c.json({
    period,
    preview,
    count: created.length,
    total: Number(created.reduce((s, r) => s + r.amount, 0).toFixed(2)),
    invoices: result,
  });
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM invoices WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
