import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useTraining,
  useCreateTraining,
  useUpdateTraining,
  useDeleteTraining,
  trainingCreateSchema,
  isPast,
  type Training,
  type TrainingCreateInput,
} from '../../features/compliance/useCompliance';
import { Modal, Badge, Field, Spinner, EmptyState } from '../../components/ui';

export const Route = createFileRoute('/compliance/training')({
  component: TrainingPage,
});

const STATUS_VARIANT: Record<Training['status'], 'success' | 'muted' | 'warning'> = {
  completed: 'success',
  planned: 'muted',
  expired: 'warning',
};

function TrainingPage() {
  const [expiringSoon, setExpiringSoon] = useState(false);
  const { data: records, isLoading } = useTraining({ expiringSoon });
  const createTraining = useCreateTraining();
  const deleteTraining = useDeleteTraining();

  const [editing, setEditing] = useState<Training | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (t: Training) => {
    setEditing(t);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Training</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add training
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={expiringSoon}
          onChange={(e) => setExpiringSoon(e.target.checked)}
        />
        Expiring soon only
      </label>

      {isLoading ? (
        <Spinner />
      ) : (records ?? []).length === 0 ? (
        <EmptyState title="No training records found" description="Add a training record to get started." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Staff</th>
                <th className="px-4 py-2 font-medium">Course</th>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Completed</th>
                <th className="px-4 py-2 font-medium">Expiry</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(records ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{t.staff_name || '—'}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{t.course_name}</td>
                  <td className="px-4 py-2">{t.provider || '—'}</td>
                  <td className="px-4 py-2">{t.completed_date ?? '—'}</td>
                  <td className="px-4 py-2">
                    {t.expiry_date ? (
                      <Badge variant={isPast(t.expiry_date) ? 'danger' : 'muted'}>
                        {t.expiry_date}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(t)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${t.course_name}?`)) deleteTraining.mutate(t.id);
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

      <TrainingModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createTraining.isPending}
        onCreate={(data) => createTraining.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function TrainingModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Training | null;
  onClose: () => void;
  onCreate: (data: TrainingCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateTraining = useUpdateTraining(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.course_name}` : 'Add training'}
    >
      <TrainingForm
        initial={editing ?? undefined}
        submitting={editing ? updateTraining.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateTraining.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

// Map an API training row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(t?: Training): Partial<TrainingCreateInput> {
  if (!t) return { status: 'completed' };
  return {
    staffName: t.staff_name || undefined,
    courseName: t.course_name,
    provider: t.provider || undefined,
    completedDate: t.completed_date ?? undefined,
    expiryDate: t.expiry_date ?? undefined,
    certificateUrl: t.certificate_url || undefined,
    status: t.status,
  };
}

function TrainingForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Training;
  onSubmit: (data: TrainingCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TrainingCreateInput>({
    resolver: zodResolver(trainingCreateSchema),
    defaultValues: toFormValues(initial),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Course name" error={errors.courseName?.message}>
        <input {...register('courseName')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Staff name" error={errors.staffName?.message}>
          <input {...register('staffName')} className="input" />
        </Field>
        <Field label="Provider" error={errors.provider?.message}>
          <input {...register('provider')} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Completed date" error={errors.completedDate?.message}>
          <input type="date" {...register('completedDate')} className="input" />
        </Field>
        <Field label="Expiry date" error={errors.expiryDate?.message}>
          <input type="date" {...register('expiryDate')} className="input" />
        </Field>
      </div>
      <Field label="Certificate URL" error={errors.certificateUrl?.message}>
        <input {...register('certificateUrl')} className="input" />
      </Field>
      <Field label="Status" error={errors.status?.message}>
        <select {...register('status')} className="input">
          <option value="planned">planned</option>
          <option value="completed">completed</option>
          <option value="expired">expired</option>
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
