import { Hono } from 'hono';
import type Stripe from 'stripe';
import { pool } from '@sprout/db/pool';
import { getStripe } from '../services/stripe';

// POST /api/billing/webhook — public endpoint (no requireAuth). Verifies the
// Stripe signature over the raw body, then updates the nursery's plan. Uses the
// pool directly (no nursery JWT context); rows are matched by client_reference_id
// or stripe_subscription_id.
const app = new Hono();

app.post('/', async (c) => {
  const raw = await c.req.text();
  const sig = c.req.header('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return c.json({ error: 'Missing signature', code: 'UNAUTHORIZED' }, 401);
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return c.json({ error: 'Invalid signature', code: 'UNAUTHORIZED' }, 401);
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    const nurseryId = s.client_reference_id ?? s.metadata?.nurseryId;
    const plan = s.metadata?.plan;
    const cycle = s.metadata?.cycle ?? 'monthly';
    if (nurseryId && plan) {
      await pool
        .query(
          `UPDATE nurseries
           SET plan=$1, billing_cycle=$2, stripe_subscription_id=$3, stripe_customer_id=$4, plan_started_at=NOW()
           WHERE id=$5`,
          [
            plan,
            cycle,
            typeof s.subscription === 'string' ? s.subscription : (s.subscription?.id ?? ''),
            typeof s.customer === 'string' ? s.customer : (s.customer?.id ?? ''),
            Number(nurseryId),
          ],
        )
        .catch(() => {});
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    await pool
      .query(
        `UPDATE nurseries SET plan='cancelled', stripe_subscription_id='' WHERE stripe_subscription_id=$1`,
        [sub.id],
      )
      .catch(() => {});
  }

  return c.json({ received: true });
});

export default app;
