import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useSend,
  useCreateSend,
  useUpdateSend,
  useDeleteSend,
  type SendFlag,
  type SendInput,
} from '../features/send/useSend';
import { useChildren } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/send')({
  component: SendPage,
});

function SendPage() {
  const { data: flags, isLoading } = useSend();
  const { data: children } = useChildren();
  const createSend = useCreateSend();
  const deleteSend = useDeleteSend();

  const [editing, setEditing] = useState<SendFlag | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const childName = (id: number) => children?.find((c) => c.id === id)?.name ?? `Child #${id}`;

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (f: SendFlag) => {
    setEditing(f);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">SEND</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add SEND record
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (flags ?? []).length === 0 ? (
        <EmptyState title="No SEND records found" description="Add a record to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(flags ?? []).map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">{childName(f.child_id)}</h2>
                  <Badge variant="info">{f.category}</Badge>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-primary" onClick={() => openEdit(f)}>
                    Edit
                  </button>
                  <button
                    className="text-sm text-danger"
                    onClick={() => {
                      if (confirm(`Delete this SEND record for ${childName(f.child_id)}?`))
                        deleteSend.mutate(f.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {f.details && <p className="mt-2 text-sm text-muted">{f.details}</p>}
              {f.support_plan && (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium text-gray-700">Support plan:</span> {f.support_plan}
                </p>
              )}
              {f.review_date && (
                <p className="mt-2 text-sm text-muted">Review: {f.review_date}</p>
              )}
              {f.flagged_by && (
                <p className="mt-1 text-xs text-muted">Flagged by {f.flagged_by}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <SendModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createSend.isPending}
        onCreate={(data) => createSend.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function SendModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: SendFlag | null;
  onClose: () => void;
  onCreate: (data: SendInput) => void;
  createSubmitting: boolean;
}) {
  const updateSend = useUpdateSend(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit SEND record' : 'Add SEND record'}>
      <SendForm
        initial={editing ?? undefined}
        submitting={editing ? updateSend.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateSend.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

function SendForm({
  initial,
  submitting,
  onSubmit,
}: {
  initial?: SendFlag;
  submitting: boolean;
  onSubmit: (data: SendInput) => void;
}) {
  const { data: children } = useChildren();
  const [childId, setChildId] = useState<number | ''>(initial?.child_id ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [details, setDetails] = useState(initial?.details ?? '');
  const [supportPlan, setSupportPlan] = useState(initial?.support_plan ?? '');
  const [reviewDate, setReviewDate] = useState(initial?.review_date ?? '');
  const [flaggedBy, setFlaggedBy] = useState(initial?.flagged_by ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (childId === '' || !category.trim()) return;
    onSubmit({
      childId: Number(childId),
      category: category.trim(),
      details: details || undefined,
      supportPlan: supportPlan || undefined,
      reviewDate: reviewDate || undefined,
      flaggedBy: flaggedBy || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Child">
        <select
          className="input"
          value={childId}
          onChange={(e) => setChildId(e.target.value === '' ? '' : Number(e.target.value))}
          required
        >
          <option value="">Select a child…</option>
          {(children ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Category">
        <input
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Speech & language"
          required
        />
      </Field>

      <Field label="Details">
        <textarea
          className="input"
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </Field>

      <Field label="Support plan">
        <textarea
          className="input"
          rows={3}
          value={supportPlan}
          onChange={(e) => setSupportPlan(e.target.value)}
        />
      </Field>

      <Field label="Review date">
        <input
          type="date"
          className="input"
          value={reviewDate ?? ''}
          onChange={(e) => setReviewDate(e.target.value)}
        />
      </Field>

      <Field label="Flagged by">
        <input
          className="input"
          value={flaggedBy}
          onChange={(e) => setFlaggedBy(e.target.value)}
        />
      </Field>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
