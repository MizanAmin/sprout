import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  assessmentCreateSchema,
  type AssessmentCreateInput,
} from '@sprout/schemas';
import { useChildren } from '../features/children/useChildren';
import {
  useAssessments,
  useCreateAssessment,
  useUpdateAssessment,
  useDeleteAssessment,
  type Assessment,
} from '../features/assessments/useAssessments';
import { Field, Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/assessment')({ component: AssessmentPage });

// The 7 EYFS prime + specific areas of learning.
const EYFS_AREAS = [
  'Communication and Language',
  'Physical Development',
  'Personal, Social and Emotional Development',
  'Literacy',
  'Mathematics',
  'Understanding the World',
  'Expressive Arts and Design',
] as const;

// EYFS development levels. The schema stores a 1–5 score; the reference app
// surfaces it as a rating, so we map score → level/band for the badge.
type LevelBand = { label: string; variant: 'danger' | 'warning' | 'success' };

function levelForScore(score: number): LevelBand {
  if (score <= 2) return { label: 'Emerging', variant: 'danger' };
  if (score === 3) return { label: 'Expected', variant: 'warning' };
  return { label: 'Exceeding', variant: 'success' };
}

// Bar colour mirrors the reference progress-fill thresholds.
function scoreColor(score: number): string {
  if (score >= 4) return 'var(--success, #16a34a)';
  if (score >= 3) return 'var(--warning, #d97706)';
  return 'var(--danger, #dc2626)';
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AssessmentPage() {
  const { data: children } = useChildren();
  const [childId, setChildId] = useState<number | undefined>(undefined);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: assessments, isLoading } = useAssessments({ childId });
  const createAssessment = useCreateAssessment();
  const deleteAssessment = useDeleteAssessment();

  const rows = assessments ?? [];

  // Average score per EYFS area for the overview grid (mirrors the reference
  // "EYFS Areas Overview" cards).
  const areaStats = useMemo(() => {
    return EYFS_AREAS.map((area) => {
      const scores = rows.filter((a) => a.area === area).map((a) => a.score);
      const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
      return { area, avg, count: scores.length };
    });
  }, [rows]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (a: Assessment) => {
    setEditing(a);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Assessment</h1>
        <button className="btn-primary" onClick={openAdd} disabled={!childId}>
          Add assessment
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="input max-w-xs"
          value={childId ?? ''}
          onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Select a child…</option>
          {(children ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {/* TODO: needs a /assessments endpoint that returns child_name (or an
            all-children view) to show every child's assessments at once like the
            reference. The current hook is per-child only (enabled when childId set). */}
      </div>

      {!childId ? (
        <EmptyState
          title="Select a child"
          description="Choose a child to view and record their EYFS development assessments."
        />
      ) : isLoading ? (
        <Spinner />
      ) : (
        <>
          {/* EYFS Areas Overview — average score per area of learning. */}
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-gray-900">EYFS Areas Overview</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {areaStats.map((s) => (
                <div key={s.area} className="rounded-lg border border-border bg-bg p-3">
                  <div className="text-[11px] font-bold text-muted">{s.area}</div>
                  <div className="my-1 text-lg font-extrabold text-gray-900">
                    {s.avg != null ? `${s.avg.toFixed(1)}/5` : '—'}
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.avg != null ? (s.avg / 5) * 100 : 0}%`,
                        backgroundColor: s.avg != null ? scoreColor(s.avg) : 'transparent',
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-muted">
                    {s.count} {s.count === 1 ? 'record' : 'records'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No assessments yet"
              description="Record an EYFS assessment across the seven areas of learning for this child."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Area</th>
                    <th className="px-4 py-2 font-medium">Level</th>
                    <th className="px-4 py-2 font-medium">Score</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Practitioner</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((a) => {
                    const level = levelForScore(a.score);
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{a.area}</td>
                        <td className="px-4 py-2">
                          <Badge variant={level.variant}>{level.label}</Badge>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">{a.score}/5</span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(a.score / 5) * 100}%`,
                                  backgroundColor: scoreColor(a.score),
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-muted">{fmtDate(a.assessed_at)}</td>
                        <td className="px-4 py-2">{a.practitioner || '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <button className="text-sm text-primary" onClick={() => openEdit(a)}>
                            Edit
                          </button>
                          <button
                            className="ml-3 text-sm text-danger"
                            onClick={() => {
                              if (confirm(`Delete ${a.area} assessment?`))
                                deleteAssessment.mutate(a.id);
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {childId && (
        <AssessmentModal
          open={modalOpen}
          editing={editing}
          childId={childId}
          onClose={() => setModalOpen(false)}
          createSubmitting={createAssessment.isPending}
          onCreate={(data) =>
            createAssessment.mutate(data, { onSuccess: () => setModalOpen(false) })
          }
        />
      )}
    </div>
  );
}

const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

// Add/edit modal. Edit uses a per-assessment update mutation hook.
function AssessmentModal({
  open,
  editing,
  childId,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Assessment | null;
  childId: number;
  onClose: () => void;
  onCreate: (data: AssessmentCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateAssessment = useUpdateAssessment(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.area}` : 'Add assessment'}
    >
      <AssessmentForm
        key={editing?.id ?? 'new'}
        childId={childId}
        initial={editing ?? undefined}
        submitting={editing ? updateAssessment.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateAssessment.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

function AssessmentForm({
  childId,
  initial,
  onSubmit,
  submitting,
}: {
  childId: number;
  initial?: Assessment;
  onSubmit: (data: AssessmentCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssessmentCreateInput>({
    resolver: zodResolver(assessmentCreateSchema),
    defaultValues: {
      childId,
      area: initial?.area ?? EYFS_AREAS[0],
      score: initial?.score ?? 3,
      practitioner: initial?.practitioner ?? '',
      notes: initial?.notes ?? '',
      assessedAt: initial?.assessed_at ?? new Date().toISOString().slice(0, 10),
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register('childId', { valueAsNumber: true })} />

      <Field label="Area of learning" error={errors.area?.message}>
        <select {...register('area')} className="input">
          {EYFS_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Score (1–5)" error={errors.score?.message}>
        <select {...register('score', numberOpt)} className="input">
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} — {levelForScore(n).label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Date assessed" error={errors.assessedAt?.message}>
        <input type="date" {...register('assessedAt')} className="input" />
      </Field>

      <Field label="Practitioner" error={errors.practitioner?.message}>
        <input {...register('practitioner')} className="input" placeholder="Recorded by…" />
      </Field>

      <Field label="Notes" error={errors.notes?.message}>
        <textarea {...register('notes')} className="input" rows={3} />
      </Field>

      {/* TODO: needs a `term` column on the assessments table + schema to record
          the EYFS term (e.g. Autumn/Spring/Summer) shown in the reference. */}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
