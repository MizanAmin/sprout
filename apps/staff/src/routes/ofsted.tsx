import { createFileRoute, Link } from '@tanstack/react-router';
import { Badge, Spinner, EmptyState } from '../components/ui';
import { useOfsted, type OfstedStatus, type OfstedSection } from '../features/ofsted/useOfsted';
import { printDocument, printHeader, escapeHtml } from '../lib/print';

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

// Build & print a browser-printable Ofsted readiness report (save-as-PDF).
function printReadinessReport(sections: OfstedSection[]): void {
  const counts = sections.reduce(
    (acc, s) => {
      acc[s.status] += 1;
      return acc;
    },
    { green: 0, amber: 0, red: 0 } as Record<OfstedStatus, number>,
  );

  const summary = `<p class="muted">${escapeHtml(
    `${sections.length} areas reviewed — ${counts.green} good, ${counts.amber} needs review, ${counts.red} action required.`,
  )}</p>`;

  const rows = sections
    .map(
      (s) =>
        `<tr>` +
        `<td>${escapeHtml(s.label)}</td>` +
        `<td><span class="pill ${s.status}">${escapeHtml(STATUS_LABEL[s.status])}</span></td>` +
        `<td>${escapeHtml(s.detail)}</td>` +
        `</tr>`,
    )
    .join('');

  const table = `<table>
    <thead><tr><th>Area</th><th>Status</th><th>Detail</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  const body = printHeader('Ofsted Inspection Readiness') + summary + table;
  printDocument('Ofsted Inspection Readiness', body);
}

// Standard EYFS SEF judgement areas. Each is matched against readiness sections
// by keyword so any relevant `detail` is pre-filled into the draft.
const SEF_AREAS: { heading: string; keywords: string[] }[] = [
  { heading: 'The effectiveness of leadership and management', keywords: ['leadership', 'management', 'manage', 'governance', 'safeguard'] },
  { heading: 'The quality of education', keywords: ['education', 'curriculum', 'teaching', 'learning', 'eyfs'] },
  { heading: 'Behaviour and attitudes', keywords: ['behaviour', 'attitude', 'attendance', 'conduct'] },
  { heading: 'Personal development', keywords: ['personal', 'development', 'welfare', 'health', 'wellbeing', 'send', 'inclusion'] },
  { heading: 'Overall effectiveness', keywords: [] },
];

// Build & print a draft EYFS Self-Evaluation Form (SEF) skeleton. This is a
// manual draft template — readiness `detail` text is pulled in where the area
// label matches, with blank prompt lines for the setting to complete.
function printSefDraft(sections: OfstedSection[]): void {
  const intro = `<p class="muted">${escapeHtml(
    'Draft Self-Evaluation Form template for manual completion. Readiness notes are pre-filled where relevant; complete the blank prompts before submission.',
  )}</p>`;

  const line = '<p>_______________________________________________________________</p>';

  const blocks = SEF_AREAS.map((area) => {
    const matched =
      area.keywords.length === 0
        ? []
        : sections.filter((s) => {
            const label = s.label.toLowerCase();
            return area.keywords.some((kw) => label.includes(kw));
          });

    const notes = matched
      .map(
        (s) =>
          `<p><strong>${escapeHtml(s.label)}</strong> ` +
          `<span class="pill ${s.status}">${escapeHtml(STATUS_LABEL[s.status])}</span><br>` +
          `${escapeHtml(s.detail)}</p>`,
      )
      .join('');

    const notesBlock = notes || `<p class="muted">${escapeHtml('No matching readiness notes.')}</p>`;

    return (
      `<h2>${escapeHtml(area.heading)}</h2>` +
      notesBlock +
      `<p><strong>${escapeHtml('Strengths:')}</strong></p>` +
      line +
      `<p><strong>${escapeHtml('Areas to develop:')}</strong></p>` +
      line
    );
  }).join('');

  const body = printHeader('Self-Evaluation Form (SEF) — Draft') + intro + blocks;
  printDocument('Self-Evaluation Form (SEF) — Draft', body);
}

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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Ofsted Mode</h1>
        <div className="flex items-center gap-3">
          {!isLoading && total > 0 && (
            <div className="flex gap-2">
              {counts.red > 0 && <Badge variant="danger">{counts.red} action required</Badge>}
              {counts.amber > 0 && <Badge variant="warning">{counts.amber} needs review</Badge>}
              {counts.green > 0 && <Badge variant="success">{counts.green} good</Badge>}
            </div>
          )}
          <button
            type="button"
            className="btn-outline"
            disabled={isLoading || total === 0}
            onClick={() => printSefDraft(sections)}
          >
            Draft SEF
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={isLoading || total === 0}
            onClick={() => printReadinessReport(sections)}
          >
            Print report
          </button>
        </div>
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
            {/* Draft SEF export is a manual draft template — see "Draft SEF" button above. */}
          </div>
        </>
      )}
    </div>
  );
}
