import { createMiddleware } from 'hono/factory';
import { pool } from '@sprout/db/pool';
import type { HonoEnv } from '../types';

// Runs after requireAuth on all non-auth routes. Blocks access (402) once the
// 14-day trial has ended and there is no active Stripe subscription. The staff
// app catches 402 globally in the TanStack Query error handler → redirects to
// /billing. ('code' added per the standard error response format.)
export const requireActiveSubscription = createMiddleware<HonoEnv>(async (c, next) => {
  const { nurseryId } = c.get('user');
  const { rows } = await pool.query(
    'SELECT plan, trial_ends_at, stripe_subscription_id FROM nurseries WHERE id=$1',
    [nurseryId],
  );
  const n = rows[0];
  // Defensive: a valid token whose nursery row is gone (deleted) → 401, not a 500.
  if (!n) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  const trialActive = n.trial_ends_at && new Date(n.trial_ends_at) > new Date();
  const subscribed = !!n.stripe_subscription_id;
  if (!trialActive && !subscribed && n.plan !== 'cancelled') {
    return c.json(
      {
        error: 'trial_expired',
        code: 'TRIAL_EXPIRED',
        message: 'Your trial has ended. Please upgrade to continue.',
      },
      402,
    );
  }
  await next();
});
