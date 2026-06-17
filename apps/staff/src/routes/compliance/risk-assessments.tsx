import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useRiskAssessments,
  useCreateRiskAssessment,
  useUpdateRiskAssessment,
  useDeleteRiskAssessment,
  riskAssessmentCreateSchema,
  type RiskAssessment,
  type RiskAssessmentCreateInput,
} from '../../features/compliance/useCompliance';
import { Modal, Badge, Field, Spinner, EmptyState } from '../../components/ui';

export const Route = createFileRoute('/compliance/risk-assessments')({
  component: RiskAssessmentsPage,
});

const STATUS_VARIANT: Record<RiskAssessment['status'], 'success' | 'muted' | 'warning'> = {
  active: 'success',
  draft: 'warning',
  archived: 'muted',
};

function RiskAssessmentsPage() {
  const { data: assessments, isLoading } = useRiskAssessments();
  const createAssessment = useCreateRiskAssessment();
  const deleteAssessment = useDeleteRiskAssessment();

  const [editing, setEditing] = useState<RiskAssessment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (a: RiskAssessment) => {
    setEditing(a);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Risk Assessments</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add risk assessment
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (assessments ?? []).length === 0 ? (
        <EmptyState title="No risk assessments found" description="Add a risk assessment to get started." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Reviewed by</th>
                <th className="px-4 py-2 font-medium">Review date</th>
                <th className="px-4 py-2 font-medium">Next review</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(assessments ?? []).map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{a.title}</td>
                  <td className="px-4 py-2">{a.location || '—'}</td>
                  <td className="px-4 py-2">{a.reviewed_by || '—'}</td>
                  <td className="px-4 py-2">{a.review_date ?? '—'}</td>
                  <td className="px-4 py-2">{a.next_review ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(a)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${a.title}?`)) deleteAssessment.mutate(a.id);
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

      <RiskAssessmentModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createAssessment.isPending}
        onCreate={(data) => createAssessment.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function RiskAssessmentModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: RiskAssessment | null;
  onClose: () => void;
  onCreate: (data: RiskAssessmentCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateAssessment = useUpdateRiskAssessment(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.title}` : 'Add risk assessment'}
    >
      <RiskAssessmentForm
        initial={editing ?? undefined}
        submitting={editing ? updateAssessment.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateAssessment.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

// Map an API risk assessment row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(a?: RiskAssessment): Partial<RiskAssessmentCreateInput> {
  if (!a) return { status: 'draft' };
  return {
    title: a.title,
    location: a.location || undefined,
    reviewedBy: a.reviewed_by || undefined,
    reviewDate: a.review_date ?? undefined,
    nextReview: a.next_review ?? undefined,
    status: a.status,
  };
}

function RiskAssessmentForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: RiskAssessment;
  onSubmit: (data: RiskAssessmentCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RiskAssessmentCreateInput>({
    resolver: zodResolver(riskAssessmentCreateSchema),
    defaultValues: toFormValues(initial),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Title" error={errors.title?.message}>
        <input {...register('title')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Location" error={errors.location?.message}>
          <input {...register('location')} className="input" />
        </Field>
        <Field label="Reviewed by" error={errors.reviewedBy?.message}>
          <input {...register('reviewedBy')} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Review date" error={errors.reviewDate?.message}>
          <input type="date" {...register('reviewDate')} className="input" />
        </Field>
        <Field label="Next review" error={errors.nextReview?.message}>
          <input type="date" {...register('nextReview')} className="input" />
        </Field>
      </div>
      <Field label="Status" error={errors.status?.message}>
        <select {...register('status')} className="input">
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
