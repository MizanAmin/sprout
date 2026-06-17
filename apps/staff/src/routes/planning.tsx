import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  usePlanning,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  type Plan,
  type PlanInput,
} from '../features/planning/usePlanning';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/planning')({
  component: PlanningPage,
});

function PlanningPage() {
  const { data: plans, isLoading } = usePlanning();
  const createPlan = useCreatePlan();
  const deletePlan = useDeletePlan();

  const [editing, setEditing] = useState<Plan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (p: Plan) => {
    setEditing(p);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Planning</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add plan
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (plans ?? []).length === 0 ? (
        <EmptyState title="No plans found" description="Add an activity plan to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(plans ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{p.title}</h2>
                <div className="flex gap-2">
                  <button className="text-sm text-primary" onClick={() => openEdit(p)}>
                    Edit
                  </button>
                  <button
                    className="text-sm text-danger"
                    onClick={() => {
                      if (confirm(`Delete ${p.title}?`)) deletePlan.mutate(p.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {p.category && <Badge variant="info">{p.category}</Badge>}
                {p.room && <Badge variant="muted">{p.room}</Badge>}
              </div>

              <p className="mt-2 text-sm text-muted">
                {[p.day, p.time].filter(Boolean).join(' · ')}
                {p.date ? ` · ${p.date}` : ''}
              </p>

              {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
            </div>
          ))}
        </div>
      )}

      <PlanModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createPlan.isPending}
        onCreate={(data) => createPlan.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function PlanModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Plan | null;
  onClose: () => void;
  onCreate: (data: PlanInput) => void;
  createSubmitting: boolean;
}) {
  const updatePlan = useUpdatePlan(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.title}` : 'Add plan'}>
      <PlanForm
        initial={editing ?? undefined}
        submitting={editing ? updatePlan.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updatePlan.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function PlanForm({
  initial,
  submitting,
  onSubmit,
}: {
  initial?: Plan;
  submitting: boolean;
  onSubmit: (data: PlanInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [day, setDay] = useState(initial?.day ?? 'Mon');
  const [time, setTime] = useState(initial?.time ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [room, setRoom] = useState(initial?.room ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial?.date ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      day: day || undefined,
      time: time || undefined,
      category: category || undefined,
      room: room || undefined,
      description: description || undefined,
      date: date || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Title">
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>

      <Field label="Day">
        <select className="input" value={day} onChange={(e) => setDay(e.target.value)}>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Time">
        <input
          type="time"
          className="input"
          value={time ?? ''}
          onChange={(e) => setTime(e.target.value)}
        />
      </Field>

      <Field label="Category">
        <input
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Literacy"
        />
      </Field>

      <Field label="Room">
        <input
          className="input"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="e.g. All"
        />
      </Field>

      <Field label="Date">
        <input
          type="date"
          className="input"
          value={date ?? ''}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
