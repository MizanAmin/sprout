import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/monitoring')({
  component: MonitoringPage,
});

function MonitoringPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">Monitoring</h1>
      <p className="mt-2 text-muted">This page is not yet implemented.</p>
    </div>
  );
}
