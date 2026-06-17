import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/funding')({
  component: FundingPage,
});

function FundingPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">Funding Reconciliation</h1>
      <p className="mt-2 text-muted">This page is not yet implemented.</p>
    </div>
  );
}
