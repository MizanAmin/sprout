import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  usePolicies,
  useCreatePolicy,
  useUpdatePolicy,
  useDeletePolicy,
  policyCreateSchema,
  type Policy,
  type PolicyCreateInput,
} from '../../features/compliance/useCompliance';
import { Modal, Badge, Field, Spinner, EmptyState } from '../../components/ui';

export const Route = createFileRoute('/compliance/policies')({
  component: PoliciesPage,
});

const STATUS_VARIANT: Record<Policy['status'], 'success' | 'muted' | 'warning'> = {
  active: 'success',
  draft: 'warning',
  archived: 'muted',
};

function PoliciesPage() {
  const { data: policies, isLoading } = usePolicies();
  const createPolicy = useCreatePolicy();
  const deletePolicy = useDeletePolicy();

  const [editing, setEditing] = useState<Policy | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (p: Policy) => {
    setEditing(p);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Policies</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add policy
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (policies ?? []).length === 0 ? (
        <EmptyState title="No policies found" description="Add a policy to get started." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Next review</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(policies ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{p.title}</td>
                  <td className="px-4 py-2">{p.category || '—'}</td>
                  <td className="px-4 py-2">{p.version}</td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-2">{p.next_review ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${p.title}?`)) deletePolicy.mutate(p.id);
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

      <PolicyModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createPolicy.isPending}
        onCreate={(data) => createPolicy.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function PolicyModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Policy | null;
  onClose: () => void;
  onCreate: (data: PolicyCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updatePolicy = useUpdatePolicy(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.title}` : 'Add policy'}>
      <PolicyForm
        initial={editing ?? undefined}
        submitting={editing ? updatePolicy.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updatePolicy.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

// Map an API policy row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(p?: Policy): Partial<PolicyCreateInput> {
  if (!p) return { status: 'active', version: '1.0' };
  return {
    title: p.title,
    category: p.category || undefined,
    content: p.content || undefined,
    version: p.version,
    reviewedAt: p.reviewed_at ?? undefined,
    nextReview: p.next_review ?? undefined,
    status: p.status,
  };
}

function PolicyForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Policy;
  onSubmit: (data: PolicyCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PolicyCreateInput>({
    resolver: zodResolver(policyCreateSchema),
    defaultValues: toFormValues(initial),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Title" error={errors.title?.message}>
        <input {...register('title')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" error={errors.category?.message}>
          <input {...register('category')} className="input" />
        </Field>
        <Field label="Version" error={errors.version?.message}>
          <input {...register('version')} className="input" />
        </Field>
      </div>
      <Field label="Content" error={errors.content?.message}>
        <textarea {...register('content')} className="input" rows={3} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Reviewed at" error={errors.reviewedAt?.message}>
          <input type="date" {...register('reviewedAt')} className="input" />
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
