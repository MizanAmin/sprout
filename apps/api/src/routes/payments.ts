import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import { getGoCardless } from '../services/gocardless';
import { PaymentCurrency } from 'gocardless-nodejs/types/Types';
import type { HonoEnv } from '../types';

// payments + payment_mandates (migration 006). Manager only.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

// This nursery's GoCardless access token ('' → platform fallback in getGoCardless).
async function nurseryGcToken(nurseryId: number): Promise<string> {
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT gocardless_access_token FROM nurseries WHERE id=$1', [nurseryId]),
  );
  return (rows[0]?.gocardless_access_token as string) || '';
}

// ---- Manual payments ----

const paymentCreateSchema = z.object({
  invoiceId: z.number().int().positive().optional(),
  childId: z.number().int().positive().optional(),
  amount: z.number().positive(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const invoiceId = c.req.query('invoiceId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM payments
       WHERE nursery_id=$1
         AND ($2::int IS NULL OR child_id=$2)
         AND ($3::int IS NULL OR invoice_id=$3)
       ORDER BY paid_at DESC`,
      [nurseryId, childId ?? null, invoiceId ?? null],
    ),
  );
  return c.json(rows);
});

// Record a manual payment and reconcile the linked invoice's amount_paid/status.
app.post('/', zValidator('json', paymentCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const row = await withTenant(nurseryId, async (client) => {
    const pay = await client.query(
      `INSERT INTO payments (nursery_id, invoice_id, child_id, amount, method, reference, notes)
       VALUES ($1,$2,$3,$4,COALESCE($5,'manual'),$6,$7) RETURNING *`,
      [nurseryId, b.invoiceId ?? null, b.childId ?? null, b.amount, b.method ?? null, b.reference ?? '', b.notes ?? ''],
    );
    if (b.invoiceId) {
      await client.query(
        `UPDATE invoices
         SET amount_paid = amount_paid + $1,
             status = CASE WHEN amount_paid + $1 >= amount THEN 'Paid' ELSE status END
         WHERE id=$2 AND nursery_id=$3`,
        [b.amount, b.invoiceId, nurseryId],
      );
    }
    return pay.rows[0];
  });
  return c.json(row, 201);
});

// ---- GoCardless Direct Debit ----

const mandateSchema = z.object({
  childId: z.number().int().positive(),
  parentEmail: z.string().email().optional(),
  parentName: z.string().optional(),
});

// Step 2–3: create a redirect flow, store session_token + redirect_flow_id, return the hosted URL.
app.post('/gocardless/mandate', zValidator('json', mandateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');

  const ctx = await withTenant(nurseryId, async (client) => {
    const child = await client.query('SELECT name FROM children WHERE id=$1 AND nursery_id=$2', [
      b.childId,
      nurseryId,
    ]);
    if (!child.rows[0]) return null;
    const rel = await client.query(
      `SELECT email, name FROM relatives
       WHERE nursery_id=$1 AND child_id=$2 AND is_primary_contact=true
       ORDER BY id LIMIT 1`,
      [nurseryId, b.childId],
    );
    return { childName: child.rows[0].name as string, relative: rel.rows[0] as { email?: string; name?: string } | undefined };
  });
  if (!ctx) return c.json({ error: 'Child not found', code: 'NOT_FOUND' }, 404);

  const parentEmail = b.parentEmail ?? ctx.relative?.email;
  const parentName = b.parentName ?? ctx.relative?.name;
  if (!parentEmail) {
    return c.json({ error: 'No parent email for this child', code: 'VALIDATION_ERROR' }, 422);
  }

  // session_token must be stored and reused on complete — generate exactly once.
  const sessionToken = `mandate-${b.childId}-${randomUUID()}`;
  const redirectFlow = await getGoCardless(await nurseryGcToken(nurseryId)).redirectFlows.create({
    description: 'Sprout Nursery invoice payments',
    session_token: sessionToken,
    success_redirect_url: `${process.env.STAFF_APP_URL}/invoices?gc_success=1`,
    prefilled_customer: { email: parentEmail, given_name: parentName },
  });

  await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO payment_mandates
         (nursery_id, child_id, child_name, mandate_id, status, parent_email, redirect_flow_id, session_token)
       VALUES ($1,$2,$3,'','pending',$4,$5,$6)`,
      [nurseryId, b.childId, ctx.childName, parentEmail, redirectFlow.id, sessionToken],
    ),
  );
  return c.json({ url: redirectFlow.redirect_url });
});

// Step 6: complete the flow using the STORED session_token (never regenerate).
app.post('/gocardless/mandate/complete', zValidator('json', z.object({ redirectFlowId: z.string().min(1) })), async (c) => {
  const { nurseryId } = c.get('user');
  const { redirectFlowId } = c.req.valid('json');

  const stored = await withTenant(nurseryId, (client) =>
    client.query('SELECT session_token FROM payment_mandates WHERE redirect_flow_id=$1 AND nursery_id=$2', [
      redirectFlowId,
      nurseryId,
    ]),
  );
  if (!stored.rows[0]) return c.json({ error: 'Mandate flow not found', code: 'NOT_FOUND' }, 404);

  const completed = await getGoCardless(await nurseryGcToken(nurseryId)).redirectFlows.complete(redirectFlowId, {
    session_token: stored.rows[0].session_token,
  });
  const mandateId = completed.links?.mandate;

  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE payment_mandates SET mandate_id=$1, status='active'
       WHERE redirect_flow_id=$2 AND nursery_id=$3 RETURNING *`,
      [mandateId, redirectFlowId, nurseryId],
    ),
  );
  return c.json(rows[0]);
});

// Collect an invoice via the child's active mandate.
app.post('/gocardless/collect', zValidator('json', z.object({ invoiceId: z.number().int().positive() })), async (c) => {
  const { nurseryId } = c.get('user');
  const { invoiceId } = c.req.valid('json');

  const data = await withTenant(nurseryId, async (client) => {
    const inv = await client.query('SELECT * FROM invoices WHERE id=$1 AND nursery_id=$2', [invoiceId, nurseryId]);
    if (!inv.rows[0]) return { error: 'invoice' as const };
    const mandate = await client.query(
      `SELECT mandate_id FROM payment_mandates WHERE child_id=$1 AND nursery_id=$2 AND status='active' ORDER BY id DESC LIMIT 1`,
      [inv.rows[0].child_id, nurseryId],
    );
    if (!mandate.rows[0]?.mandate_id) return { error: 'mandate' as const };
    return { invoice: inv.rows[0], mandateId: mandate.rows[0].mandate_id as string };
  });
  if ('error' in data) {
    return data.error === 'invoice'
      ? c.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, 404)
      : c.json({ error: 'No active Direct Debit mandate for this child', code: 'NO_MANDATE' }, 422);
  }

  const payment = await getGoCardless(await nurseryGcToken(nurseryId)).payments.create({
    amount: String(Math.round(Number(data.invoice.amount) * 100)), // pence, as string
    currency: PaymentCurrency.GBP,
    description: `Sprout invoice ${data.invoice.invoice_ref}`,
    links: { mandate: data.mandateId },
  });

  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE invoices SET gocardless_payment_id=$1, status='Pending' WHERE id=$2 AND nursery_id=$3 RETURNING *`,
      [payment.id, invoiceId, nurseryId],
    ),
  );
  return c.json(rows[0]);
});

export default app;
