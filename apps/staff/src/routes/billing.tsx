import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { PLANS, type PlanKey, type BillingCycle } from '@sprout/schemas';
import { api } from '../api';
import { useStore } from '../store';
import { gbp } from '../components/ui';

export const Route = createFileRoute('/billing')({
  component: BillingPage,
});

const FEATURE_LABELS: Record<string, string> = {
  autoInvoice: 'Automated invoicing',
  compliance: 'Compliance tools',
  staffDev: 'Staff development',
  ai: 'AI features',
};

function BillingPage() {
  const nursery = useStore((s) => s.nursery);
  const currentPlan = nursery?.plan;
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  const checkout = useMutation({
    mutationFn: (plan: PlanKey) => api.post<{ url: string }>('/billing/checkout', { plan, cycle }),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
  });

  const portal = useMutation({
    mutationFn: () => api.post<{ url: string }>('/billing/portal', {}),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Subscription &amp; Billing</h1>
        <button
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          onClick={() => portal.mutate()}
          disabled={portal.isPending}
        >
          {portal.isPending ? 'Opening…' : 'Manage subscription'}
        </button>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-surface p-1">
        {(['monthly', 'annual'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCycle(c)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              cycle === c ? 'bg-primary text-white' : 'text-muted hover:text-gray-700'
            }`}
          >
            {c === 'monthly' ? 'Monthly' : 'Annual'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(PLANS) as PlanKey[]).map((key) => {
          const plan = PLANS[key];
          const isCurrent = currentPlan === key;
          const price = cycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
          return (
            <div
              key={key}
              className={`flex flex-col rounded-xl border bg-surface p-5 ${
                isCurrent ? 'border-primary ring-1 ring-primary' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{plan.name}</h2>
                {isCurrent && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Current
                  </span>
                )}
              </div>

              <div className="mt-2">
                <span className="text-2xl font-semibold text-gray-900">{gbp(price)}</span>
                <span className="text-sm text-muted">/{cycle === 'monthly' ? 'mo' : 'yr'}</span>
              </div>

              <p className="mt-1 text-sm text-muted">
                {plan.childrenLimit == null ? 'Unlimited children' : `Up to ${plan.childrenLimit} children`}
              </p>

              <ul className="mt-4 flex-1 space-y-1 text-sm">
                {Object.entries(plan.features).map(([feat, on]) => (
                  <li key={feat} className={on ? 'text-gray-700' : 'text-gray-300 line-through'}>
                    {on ? '✓' : '✕'} {FEATURE_LABELS[feat] ?? feat}
                  </li>
                ))}
              </ul>

              <button
                className="btn-primary mt-5"
                disabled={isCurrent || checkout.isPending}
                onClick={() => checkout.mutate(key)}
              >
                {isCurrent ? 'Current plan' : 'Upgrade'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
