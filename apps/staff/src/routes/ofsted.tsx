import { createFileRoute, Link } from '@tanstack/react-router';
import { Badge, Spinner, EmptyState } from '../components/ui';
import { useOfsted, type OfstedStatus, type OfstedSection } from '../features/ofsted/useOfsted';

export const Route = createFileRoute('/ofsted')({
  component: OfstedPage,
});

// RAG status presentation — mirrors the reference app's colour-coded report card.
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

const STATUS_ACCENT: Record<OfstedStatus, string> = {
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
};

// Quick-access tiles — like the reference's document tiles, deep-linking to the
// underlying records an inspector / manager would want to open.
const QUICK_LINKS = [
  { to: '/compliance', label: 'Compliance', hint: 'Policies, risk assessments & training' },
  { to: '/children', label: 'Children', hint: 'Enrolment, attendance & SEND' },
  { to: '/staff', label: 'Staff', hint: 'DBS, qualifications & ratios' },
  { to: '/accident-book', label: 'Accident Book', hint: 'Incidents & RIDDOR records' },
] as const;

function ReadinessCard({ section }: { section: OfstedSection }) {
  const accent = STATUS_ACCENT[section.status];
  return (
    <div
      className="card"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-gray-900">{section.label}</h2>
        <Badge variant={STATUS_BADGE[section.status]}>{STATUS_LABEL[section.status]}</Badge>
      </div>
      <p className={`mt-3 text-sm ${section.status === 'red' ? 'text-danger' : 'text-muted'}`}>
        {section.detail}
      </p>
      {(section.status === 'red' || section.status === 'amber') && (
        <p className="mt-2 text-xs font-medium" style={{ color: accent }}>
          Review before inspection
        </p>
      )}
    </div>
  );
}

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

  const total = sections.length;
  const ready = counts.green;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Ofsted Mode</h1>
        {!isLoading && total > 0 && (
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
        <Spinner label="Running inspection checks…" />
      ) : total === 0 ? (
        <EmptyState title="No readiness data" description="Nothing to report yet." />
      ) : (
        <>
          {/* Header roll-up — overall readiness across all RAG areas. */}
          <div className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted">Areas at Good standard</div>
              <div
                className="mt-1 text-3xl font-bold"
                style={{
                  color:
                    ready === total
                      ? STATUS_ACCENT.green
                      : counts.red === 0
                        ? STATUS_ACCENT.amber
                        : STATUS_ACCENT.red,
                }}
              >
                {ready}/{total}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{counts.green}</div>
                <div className="text-xs text-muted">Good</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">{counts.amber}</div>
                <div className="text-xs text-muted">Needs review</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-danger">{counts.red}</div>
                <div className="text-xs text-muted">Action required</div>
              </div>
            </div>
          </div>

          {/* Inspection report card — one RAG card per readiness area. */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Inspection Report Card
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((s) => (
                <ReadinessCard key={s.key} section={s} />
              ))}
            </div>
          </div>

          {/* Quick-access tiles — jump straight to the underlying records. */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Quick Access
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="card text-left transition-colors hover:border-primary"
                >
                  <div className="font-semibold text-gray-900">{link.label}</div>
                  <div className="mt-1 text-xs text-muted">{link.hint}</div>
                </Link>
              ))}
            </div>
            {/* TODO: needs GET /ofsted/report + GET /ofsted/sef to add the reference's
                EYFS coverage table, staff-ratio breakdown, and draft SEF export. */}
          </div>
        </>
      )}
    </div>
  );
}
