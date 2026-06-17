import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useReflections,
  useCreateReflection,
  useUpdateReflection,
  useDeleteReflection,
  type Reflection,
  type ReflectionInput,
} from '../features/reflections/useReflections';
import { useChildren } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/reflections')({
  component: ReflectionsPage,
});

function ReflectionsPage() {
  const { data: reflections, isLoading } = useReflections();
  const { data: children } = useChildren();
  const createReflection = useCreateReflection();
  const deleteReflection = useDeleteReflection();

  const [editing, setEditing] = useState<Reflection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const childName = (id: number) => children?.find((c) => c.id === id)?.name ?? `Child #${id}`;

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (r: Reflection) => {
    setEditing(r);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Reflections</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add reflection
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (reflections ?? []).length === 0 ? (
        <EmptyState title="No reflections found" description="Add a reflection to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(reflections ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">{childName(r.child_id)}</h2>
                  {r.date && <p className="text-xs text-muted">{r.date}</p>}
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-primary" onClick={() => openEdit(r)}>
                    Edit
                  </button>
                  <button
                    className="text-sm text-danger"
                    onClick={() => {
                      if (confirm(`Delete this reflection for ${childName(r.child_id)}?`))
                        deleteReflection.mutate(r.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {r.what_went_well && (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium text-gray-700">What went well:</span>{' '}
                  {r.what_went_well}
                </p>
              )}
              {r.areas_for_development && (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium text-gray-700">Areas for development:</span>{' '}
                  {r.areas_for_development}
                </p>
              )}
              {r.next_steps && (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium text-gray-700">Next steps:</span> {r.next_steps}
                </p>
              )}
              {r.practitioner && (
                <p className="mt-2 text-xs text-muted">By {r.practitioner}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <ReflectionModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createReflection.isPending}
        onCreate={(data) =>
          createReflection.mutate(data, { onSuccess: () => setModalOpen(false) })
        }
      />
    </div>
  );
}

function ReflectionModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Reflection | null;
  onClose: () => void;
  onCreate: (data: ReflectionInput) => void;
  createSubmitting: boolean;
}) {
  const updateReflection = useUpdateReflection(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit reflection' : 'Add reflection'}>
      <ReflectionForm
        initial={editing ?? undefined}
        submitting={editing ? updateReflection.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateReflection.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

function ReflectionForm({
  initial,
  submitting,
  onSubmit,
}: {
  initial?: Reflection;
  submitting: boolean;
  onSubmit: (data: ReflectionInput) => void;
}) {
  const { data: children } = useChildren();
  const [childId, setChildId] = useState<number | ''>(initial?.child_id ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [whatWentWell, setWhatWentWell] = useState(initial?.what_went_well ?? '');
  const [areasForDevelopment, setAreasForDevelopment] = useState(
    initial?.areas_for_development ?? '',
  );
  const [nextSteps, setNextSteps] = useState(initial?.next_steps ?? '');
  const [practitioner, setPractitioner] = useState(initial?.practitioner ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (childId === '') return;
    onSubmit({
      childId: Number(childId),
      date: date || undefined,
      whatWentWell: whatWentWell || undefined,
      areasForDevelopment: areasForDevelopment || undefined,
      nextSteps: nextSteps || undefined,
      practitioner: practitioner || undefined,
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

      <Field label="Date">
        <input
          type="date"
          className="input"
          value={date ?? ''}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <Field label="What went well">
        <textarea
          className="input"
          rows={3}
          value={whatWentWell}
          onChange={(e) => setWhatWentWell(e.target.value)}
        />
      </Field>

      <Field label="Areas for development">
        <textarea
          className="input"
          rows={3}
          value={areasForDevelopment}
          onChange={(e) => setAreasForDevelopment(e.target.value)}
        />
      </Field>

      <Field label="Next steps">
        <textarea
          className="input"
          rows={3}
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
        />
      </Field>

      <Field label="Practitioner">
        <input
          className="input"
          value={practitioner}
          onChange={(e) => setPractitioner(e.target.value)}
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
