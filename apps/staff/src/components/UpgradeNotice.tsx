import { Link } from '@tanstack/react-router';

// True when a query/mutation error is the API's plan-feature gate.
export function isPlanError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'PLAN_UPGRADE_REQUIRED';
}

// Inline "this feature needs a higher plan" card, shown in place of a gated
// page's content instead of redirecting to billing.
export function UpgradeNotice({ feature, plan = 'Blossom' }: { feature: string; plan?: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
      <div className="mb-3 text-4xl">🔒</div>
      <h2 className="text-lg font-semibold text-gray-900">{feature} is a {plan} feature</h2>
      <p className="mt-2 text-sm text-muted">
        Your current plan doesn’t include {feature}. Upgrade to {plan} or higher to unlock it.
      </p>
      <Link to="/billing" className="btn-primary mt-5 inline-flex">
        View plans &amp; upgrade
      </Link>
    </div>
  );
}
