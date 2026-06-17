import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/planning')({
  component: PlanningPage,
});

function PlanningPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">Planning</h1>
      <p className="mt-2 text-muted">This page is not yet implemented.</p>
    </div>
  );
}
