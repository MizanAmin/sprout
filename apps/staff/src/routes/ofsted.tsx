import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/ofsted')({
  component: OfstedPage,
});

function OfstedPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">Ofsted Mode</h1>
      <p className="mt-2 text-muted">This page is not yet implemented.</p>
    </div>
  );
}
