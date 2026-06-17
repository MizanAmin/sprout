import { createFileRoute } from '@tanstack/react-router';
import { Badge, Spinner, EmptyState } from '../components/ui';
import { useOfsted, type OfstedStatus } from '../features/ofsted/useOfsted';

export const Route = createFileRoute('/ofsted')({
  component: OfstedPage,
});

const STATUS_BADGE: Record<OfstedStatus, 'success' | 'warning' | 'danger'> = {
  green: 'success',
  amber: 'warning',
  red: 'danger',
};

const STATUS_LABEL: Record<OfstedStatus, string> = {
  green: 'Good',
  amber: 'Needs review',
  red: 'Action required',
};

const STATUS_DOT: Record<OfstedStatus, string> = {
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
};

function OfstedPage() {
  const { data, isLoading } = useOfsted();
  const sections = data?.sections ?? [];

  const counts = sections.reduce(
    (acc, s) => {
      acc[s.status] += 1;
      return acc;
    },
    { green: 0, amber: 0, red: 0 } as Record<OfstedStatus, number>,
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Ofsted Mode</h1>
        {!isLoading && sections.length > 0 && (
          <div className="flex gap-2">
            {counts.red > 0 && <Badge variant="danger">{counts.red} action required</Badge>}
            {counts.amber > 0 && <Badge variant="warning">{counts.amber} needs review</Badge>}
            {counts.green > 0 && <Badge variant="success">{counts.green} good</Badge>}
          </div>
        )}
      </div>

      <p className="text-sm text-muted">
        Read-only RAG readiness summary. Thresholds are heuristic — review the underlying records
        before an inspection.
      </p>

      {isLoading ? (
        <Spinner />
      ) : sections.length === 0 ? (
        <EmptyState title="No readiness data" description="Nothing to report yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <div key={s.key} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: STATUS_DOT[s.status] }}
                  />
                  <h2 className="font-semibold text-gray-900">{s.label}</h2>
                </div>
                <Badge variant={STATUS_BADGE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
              </div>
              <p
                className={`mt-3 text-sm ${s.status === 'red' ? 'text-danger' : 'text-muted'}`}
              >
                {s.detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
