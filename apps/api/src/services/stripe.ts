import Stripe from 'stripe';
import type { BillingCycle, PlanKey } from '@sprout/schemas';

// Lazy singleton so the API boots without Stripe configured.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  _stripe = new Stripe(key);
  return _stripe;
}

// Resolve the Stripe Price ID for a plan + cycle from env
// (STRIPE_PRICE_<PLAN>_<MONTHLY|ANNUAL>). Returns undefined for the free-tier
// 'seedling' or any unconfigured price.
export function priceIdFor(plan: PlanKey, cycle: BillingCycle): string | undefined {
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`];
}
