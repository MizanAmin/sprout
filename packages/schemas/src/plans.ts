// Subscription plan catalogue — single source of truth for both the staff app
// (feature gating / billing UI) and the API (billing checkout, plan features).
export const PLANS = {
  seedling: {
    name: 'Seedling',
    priceMonthly: 49,
    priceAnnual: 490,
    childrenLimit: 20,
    features: { autoInvoice: false, compliance: false, staffDev: false, ai: false },
  },
  blossom: {
    name: 'Blossom',
    priceMonthly: 99,
    priceAnnual: 990,
    childrenLimit: 50,
    features: { autoInvoice: true, compliance: true, staffDev: true, ai: false },
  },
  grove: {
    name: 'Grove',
    priceMonthly: 179,
    priceAnnual: 1790,
    childrenLimit: 100,
    features: { autoInvoice: true, compliance: true, staffDev: true, ai: true },
  },
  forest: {
    name: 'Forest',
    priceMonthly: 299,
    priceAnnual: 2990,
    childrenLimit: null,
    features: { autoInvoice: true, compliance: true, staffDev: true, ai: true },
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type BillingCycle = 'monthly' | 'annual';
