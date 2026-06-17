import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PLANS } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import { getStripe, priceIdFor } from '../services/stripe';
import type { HonoEnv } from '../types';

// Subscription billing (Stripe Checkout). Manager only.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

app.get('/plans', (c) => c.json(PLANS));

// Subscription status for the caller's nursery: plan, trial state, and children usage
// against the plan's limit (PLANS.<plan>.childrenLimit; null = unlimited on Forest).
app.get('/status', async (c) => {
  const { nurseryId } = c.get('user');
  const result = await withTenant(nurseryId, async (client) => {
    const nursery = await client.query(
      'SELECT plan, trial_ends_at FROM nurseries WHERE id=$1',
      [nurseryId],
    );
    const children = await client.query(
      `SELECT COUNT(*)::int AS count FROM children WHERE nursery_id=$1 AND status='Active'`,
      [nurseryId],
    );
    return { nursery: nursery.rows[0], childrenCount: children.rows[0].count as number };
  });

  const n = result.nursery as { plan?: string; trial_ends_at?: string | null } | undefined;
  const plan = n?.plan ?? 'seedling';
  const childrenLimit = plan in PLANS ? PLANS[plan as keyof typeof PLANS].childrenLimit : null;

  return c.json({
    plan,
    childrenCount: result.childrenCount,
    childrenLimit,
    trialEndsAt: n?.trial_ends_at ?? null,
  });
});

const checkoutSchema = z.object({
  plan: z.enum(['seedling', 'blossom', 'grove', 'forest']),
  cycle: z.enum(['monthly', 'annual']),
});

// Create a Stripe Checkout session for the chosen plan/cycle and return its URL.
app.post('/checkout', zValidator('json', checkoutSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const { plan, cycle } = c.req.valid('json');

  const price = priceIdFor(plan, cycle);
  if (!price) {
    return c.json({ error: `No Stripe price configured for ${plan}/${cycle}`, code: 'VALIDATION_ERROR' }, 422);
  }

  const nursery = await withTenant(nurseryId, (client) =>
    client.query('SELECT email, stripe_customer_id FROM nurseries WHERE id=$1', [nurseryId]),
  );
  const n = nursery.rows[0] as { email?: string; stripe_customer_id?: string };

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    client_reference_id: String(nurseryId),
    customer: n?.stripe_customer_id || undefined,
    customer_email: n?.stripe_customer_id ? undefined : n?.email || undefined,
    // The webhook reads these to set the nursery's plan/cycle on completion.
    metadata: { nurseryId: String(nurseryId), plan, cycle },
    success_url: `${process.env.STAFF_APP_URL}/billing?success=1`,
    cancel_url: `${process.env.STAFF_APP_URL}/billing?canceled=1`,
  });

  return c.json({ url: session.url });
});

// Stripe Customer Portal — manage/cancel an existing subscription.
app.post('/portal', async (c) => {
  const { nurseryId } = c.get('user');
  const nursery = await withTenant(nurseryId, (client) =>
    client.query('SELECT stripe_customer_id FROM nurseries WHERE id=$1', [nurseryId]),
  );
  const customerId = nursery.rows[0]?.stripe_customer_id;
  if (!customerId) {
    return c.json({ error: 'No active subscription', code: 'NO_SUBSCRIPTION' }, 422);
  }
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.STAFF_APP_URL}/billing`,
  });
  return c.json({ url: session.url });
});

export default app;
