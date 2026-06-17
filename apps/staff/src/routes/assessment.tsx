import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assessmentCreateSchema, type AssessmentCreateInput } from '@sprout/schemas';
import { useChildren } from '../features/children/useChildren';
import {
  useAssessments,
  useCreateAssessment,
  useDeleteAssessment,
} from '../features/assessments/useAssessments';
import { Field, Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/assessment')({ component: AssessmentPage });

const EYFS_AREAS = [
  'Communication and Language',
  'Physical Development',
  'Personal, Social and Emotional Development',
  'Literacy',
  'Mathematics',
  'Understanding the World',
  'Expressive Arts and Design',
];

function AssessmentPage() {
  const { data: children } = useChildren();
  const [childId, setChildId] = useState<number | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: assessments, isLoading } = useAssessments({ childId });
  const createAssessment = useCreateAssessment();
  const deleteAssessment = useDeleteAssessment();

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Assessment</h1>
        <button className="btn-primary" onClick={() => setModalOpen(true)} disabled={!childId}>
          Add assessment
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="input max-w-xs"
          value={childId ?? ''}
          onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Select child…</option>
          {children?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!childId ? (
        <EmptyState title="Select a child" description="Choose a child to view their EYFS scores." />
      ) : isLoading ? (
        <Spinner />
      ) : !assessments?.length ? (
        <EmptyState title="No assessments" description="Add an assessment for this child." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Area</th>
                <th className="px-4 py-2 font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Practitioner</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assessments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{a.area}</td>
                  <td className="px-4 py-2">
                    <Badge variant="info">{a.score}/5</Badge>
                  </td>
                  <td className="px-4 py-2">{a.assessed_at ?? '—'}</td>
                  <td className="px-4 py-2">{a.practitioner || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${a.area} assessment?`)) deleteAssessment.mutate(a.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {childId && (
        <AddAssessmentModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          childId={childId}
          submitting={createAssessment.isPending}
          onSubmit={(data) =>
            createAssessment.mutate(data, { onSuccess: () => setModalOpen(false) })
          }
        />
      )}
    </div>
  );
}

const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

function AddAssessmentModal({
  open,
  onClose,
  childId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  childId: number;
  onSubmit: (data: AssessmentCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssessmentCreateInput>({
    resolver: zodResolver(assessmentCreateSchema),
    defaultValues: { childId, area: EYFS_AREAS[0], score: 3 },
  });

  return (
    <Modal open={open} onClose={onClose} title="Add assessment">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register('childId', { valueAsNumber: true })} />
        <Field label="Area" error={errors.area?.message}>
          <select {...register('area')} className="input">
            {EYFS_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Score (1–5)" error={errors.score?.message}>
          <input type="number" min={1} max={5} {...register('score', numberOpt)} className="input" />
        </Field>
        <Field label="Practitioner" error={errors.practitioner?.message}>
          <input {...register('practitioner')} className="input" />
        </Field>
        <Field label="Notes" error={errors.notes?.message}>
          <textarea {...register('notes')} className="input" rows={2} />
        </Field>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
