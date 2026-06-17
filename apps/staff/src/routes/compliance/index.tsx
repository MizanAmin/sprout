import { createFileRoute, Link } from '@tanstack/react-router';
import { usePolicies, useRiskAssessments, useTraining } from '../../features/compliance/useCompliance';

export const Route = createFileRoute('/compliance/')({
  component: CompliancePage,
});

function CompliancePage() {
  const { data: policies } = usePolicies();
  const { data: riskAssessments } = useRiskAssessments();
  const { data: training } = useTraining();

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Compliance Hub</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard to="/compliance/policies" label="Policies" count={policies?.length} />
        <SummaryCard
          to="/compliance/risk-assessments"
          label="Risk assessments"
          count={riskAssessments?.length}
        />
        <SummaryCard to="/compliance/training" label="Training" count={training?.length} />
      </div>
    </div>
  );
}

function SummaryCard({ to, label, count }: { to: string; label: string; count?: number }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-border bg-surface p-4 hover:border-primary"
    >
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{count ?? '—'}</div>
    </Link>
  );
}
