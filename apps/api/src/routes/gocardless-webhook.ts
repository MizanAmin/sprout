import { Hono } from 'hono';
import { pool } from '@sprout/db/pool';
import { verifyGoCardlessSignature } from '../services/gocardless';

// POST /api/payments/gocardless-webhook — public endpoint (no requireAuth).
// Signature-verified, then updates invoices/mandates by their GoCardless IDs.
// Uses the pool directly (not withTenant): webhooks have no nursery/JWT context
// and match cross-tenant by gocardless_payment_id / mandate_id.
const app = new Hono();

interface GCEvent {
  resource_type: string;
  action: string;
  links?: { payment?: string; mandate?: string };
}

app.post('/', async (c) => {
  const raw = await c.req.text();
  if (!verifyGoCardlessSignature(raw, c.req.header('Webhook-Signature'))) {
    return c.json({ error: 'Invalid signature', code: 'UNAUTHORIZED' }, 401);
  }

  let events: GCEvent[] = [];
  try {
    events = (JSON.parse(raw).events ?? []) as GCEvent[];
  } catch {
    return c.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, 422);
  }

  for (const ev of events) {
    if (ev.resource_type === 'payments') {
      const paymentId = ev.links?.payment;
      if (!paymentId) continue;
      if (ev.action === 'confirmed' || ev.action === 'paid_out') {
        await pool
          .query(
            `UPDATE invoices SET status='Paid', amount_paid=amount WHERE gocardless_payment_id=$1`,
            [paymentId],
          )
          .catch(() => {});
      } else if (ev.action === 'failed' || ev.action === 'cancelled' || ev.action === 'charged_back') {
        await pool
          .query(`UPDATE invoices SET status='Overdue' WHERE gocardless_payment_id=$1`, [paymentId])
          .catch(() => {});
        // TODO: optionally email the manager about the failed collection.
      }
    } else if (ev.resource_type === 'mandates') {
      const mandateId = ev.links?.mandate;
      if (!mandateId) continue;
      if (ev.action === 'cancelled') {
        await pool
          .query(`UPDATE payment_mandates SET status='cancelled' WHERE mandate_id=$1`, [mandateId])
          .catch(() => {});
      } else if (ev.action === 'expired') {
        await pool
          .query(`UPDATE payment_mandates SET status='expired' WHERE mandate_id=$1`, [mandateId])
          .catch(() => {});
      }
    }
  }

  // Always 200 so GoCardless does not retry a successfully-received batch.
  return c.json({ ok: true });
});

export default app;
