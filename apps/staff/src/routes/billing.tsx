import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PLANS, type PlanKey, type BillingCycle } from '@sprout/schemas';
import { api } from '../api';
import { useStore } from '../store';
import { Spinner, EmptyState, Badge, gbp } from '../components/ui';

export const Route = createFileRoute('/billing')({
  component: BillingPage,
});

// Plans render in catalogue order (cheapest → richest); used for upgrade/downgrade labels.
const PLAN_ORDER: PlanKey[] = ['seedling', 'blossom', 'grove', 'forest'];

// GET /billing/status — subscription + children usage for the caller's nursery.
interface BillingStatus {
  plan: string;
  childrenCount: number;
  childrenLimit: number | null;
  trialEndsAt: string | null;
}

// Mirrors the reference app's per-feature copy (plans.ts only exposes boolean flags).
const FEATURE_LABELS: Record<string, string> = {
  autoInvoice: 'Automated invoicing',
  compliance: 'Compliance Hub',
  staffDev: 'Staff development',
  ai: 'AI Assistant',
};

// Human-readable trial state derived from nursery.trialEndsAt (no dedicated status endpoint).
function trialInfo(trialEndsAt?: string | null): { active: boolean; daysLeft: number } {
  if (!trialEndsAt) return { active: false, daysLeft: 0 };
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  const daysLeft = Math.ceil(ms / 86_400_000);
  return { active: daysLeft > 0, daysLeft };
}

function BillingPage() {
  const nursery = useStore((s) => s.nursery);
  const currentPlan = nursery?.plan;
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  // Plan catalogue is served from the API (GET /billing/plans) so pricing stays in sync
  // with the backend; typed via the shared PLANS schema shape.
  const plansQuery = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get<typeof PLANS>('/billing/plans'),
  });

  // Children usage (used / limit) + plan/trial straight from the nursery row.
  const statusQuery = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: () => api.get<BillingStatus>('/billing/status'),
  });

  const checkout = useMutation({
    mutationFn: (plan: PlanKey) =>
      api.post<{ url: string }>('/billing/checkout', { plan, cycle }),
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

  const plans = plansQuery.data;
  const trial = trialInfo(nursery?.trialEndsAt);
  const isCancelled = currentPlan === 'cancelled';

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Subscription &amp; Billing</h1>

      {plansQuery.isLoading ? (
        <Spinner label="Loading plans…" />
      ) : plansQuery.isError || !plans ? (
        <EmptyState
          title="Couldn't load plans"
          description="There was a problem fetching the subscription plans. Please try again."
        />
      ) : (
        <>
          {/* Current plan card — status + trial badge */}
          <CurrentPlanCard
            currentPlan={currentPlan}
            plans={plans}
            cycle={cycle}
            trial={trial}
            isCancelled={isCancelled}
            status={statusQuery.data}
            onManage={() => portal.mutate()}
            managing={portal.isPending}
          />

          {/* Monthly / annual toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Choose your plan</h2>
              <p className="text-sm text-muted">
                All plans include a 14-day free trial for new nurseries. Cancel any time.
              </p>
            </div>
            <div className="inline-flex shrink-0 rounded-lg border border-border bg-surface p-1">
              {(['monthly', 'annual'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                    cycle === c ? 'bg-primary text-white' : 'text-muted hover:text-primary'
                  }`}
                >
                  {c === 'monthly' ? 'Monthly' : 'Annual'}
                  {c === 'annual' && (
                    <span className="ml-1.5 text-xs font-normal opacity-80">2 months free</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLAN_ORDER.map((key) => (
              <PlanCard
                key={key}
                planKey={key}
                plan={plans[key]}
                cycle={cycle}
                currentPlan={currentPlan}
                onUpgrade={() => checkout.mutate(key)}
                upgrading={checkout.isPending}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CurrentPlanCard({
  currentPlan,
  plans,
  cycle,
  trial,
  isCancelled,
  status,
  onManage,
  managing,
}: {
  currentPlan?: string;
  plans: typeof PLANS;
  cycle: BillingCycle;
  trial: { active: boolean; daysLeft: number };
  isCancelled: boolean;
  status?: BillingStatus;
  onManage: () => void;
  managing: boolean;
}) {
  const planKey = (currentPlan && currentPlan in plans ? currentPlan : 'seedling') as PlanKey;
  const plan = plans[planKey];
  const price = cycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
  const period = cycle === 'monthly' ? 'month' : 'year';

  return (
    <div className="card border-l-4 border-l-primary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{plan.name} Plan</h2>
            {isCancelled ? (
              <Badge variant="danger">Cancelled</Badge>
            ) : trial.active ? (
              <Badge variant="info">Trial</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {gbp(price)}/{period}
            {cycle === 'annual' && ' (2 months free)'}
          </p>
          {trial.active && (
            <p className="mt-1 text-sm text-info">
              Free trial active — {trial.daysLeft} day{trial.daysLeft !== 1 ? 's' : ''} remaining.
              No charge until your trial ends.
            </p>
          )}
          <ChildrenUsage plan={plan} status={status} />
        </div>
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={onManage}
          disabled={managing}
        >
          {managing ? 'Opening…' : 'Manage billing & invoices'}
        </button>
      </div>
    </div>
  );
}

// Children usage line + progress bar (used / limit). Falls back to the static plan
// limit while GET /billing/status is loading or unavailable.
function ChildrenUsage({
  plan,
  status,
}: {
  plan: (typeof PLANS)[PlanKey];
  status?: BillingStatus;
}) {
  const limit = status?.childrenLimit ?? plan.childrenLimit;
  const used = status?.childrenCount;

  if (limit == null) {
    return (
      <p className="mt-1 text-sm text-muted">
        {used != null ? `${used} children · unlimited` : 'Unlimited children'}
      </p>
    );
  }

  if (used == null) {
    return <p className="mt-1 text-sm text-muted">Up to {limit} children</p>;
  }

  const pct = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  const tone = pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-primary';

  return (
    <div className="mt-2 max-w-xs">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Children</span>
        <span className="font-medium text-gray-900">
          {used} / {limit}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 100 && (
        <p className="mt-1 text-xs text-danger">Plan limit reached — upgrade to add more children.</p>
      )}
    </div>
  );
}

function PlanCard({
  planKey,
  plan,
  cycle,
  currentPlan,
  onUpgrade,
  upgrading,
}: {
  planKey: PlanKey;
  plan: (typeof PLANS)[PlanKey];
  cycle: BillingCycle;
  currentPlan?: string;
  onUpgrade: () => void;
  upgrading: boolean;
}) {
  const isCurrent = currentPlan === planKey;
  const price = cycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
  const period = cycle === 'monthly' ? 'mo' : 'yr';

  const curIdx = currentPlan ? PLAN_ORDER.indexOf(currentPlan as PlanKey) : -1;
  const thisIdx = PLAN_ORDER.indexOf(planKey);
  const isUpgrade = thisIdx > curIdx;

  const buttonLabel = isCurrent
    ? 'Current plan'
    : isUpgrade
      ? `Upgrade to ${plan.name}`
      : `Switch to ${plan.name}`;

  return (
    <div className={`card flex flex-col ${isCurrent ? 'ring-1 ring-primary' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
        {isCurrent && <Badge variant="info">Current</Badge>}
        {planKey === 'grove' && !isCurrent && <Badge variant="success">Popular</Badge>}
      </div>

      <div className="mt-2">
        <span className="text-2xl font-semibold text-gray-900">{gbp(price)}</span>
        <span className="text-sm text-muted">/{period}</span>
      </div>

      <p className="mt-1 text-sm text-muted">
        {plan.childrenLimit == null
          ? 'Unlimited children'
          : `Up to ${plan.childrenLimit} children`}
      </p>

      <ul className="mt-4 flex-1 space-y-1.5 text-sm">
        {Object.entries(plan.features).map(([feat, on]) => (
          <li
            key={feat}
            className={`flex items-start gap-2 ${on ? 'text-gray-700' : 'text-gray-300'}`}
          >
            <span className="shrink-0">{on ? '✓' : '✕'}</span>
            <span className={on ? '' : 'line-through'}>{FEATURE_LABELS[feat] ?? feat}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={isUpgrade ? 'btn-primary mt-5' : 'btn-outline mt-5'}
        disabled={isCurrent || upgrading}
        onClick={onUpgrade}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
