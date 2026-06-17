import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { AccidentCreateInput } from '@sprout/schemas';
import {
  useAccidentBook,
  useCreateAccident,
  useUpdateAccident,
  useDeleteAccident,
  type Accident,
} from '../features/accident-book/useAccidentBook';
import { useChildren } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/accident-book')({
  component: AccidentBookPage,
});

function AccidentBookPage() {
  const { data: accidents, isLoading } = useAccidentBook();
  const createAccident = useCreateAccident();
  const deleteAccident = useDeleteAccident();

  const [editing, setEditing] = useState<Accident | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (a: Accident) => {
    setEditing(a);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Accident Book</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add accident
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (accidents ?? []).length === 0 ? (
        <EmptyState
          title="No accident records found"
          description="Add an accident record to get started."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(accidents ?? []).map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{a.injury_type || 'Accident'}</h2>
                <Badge variant={a.parent_notified_at ? 'success' : 'warning'}>
                  {a.parent_notified_at ? 'Parent notified' : 'Parent not notified'}
                </Badge>
              </div>
              {a.child_name && <p className="mt-1 text-sm text-muted">Child: {a.child_name}</p>}
              <p className="mt-1 text-sm text-muted">
                {a.date}
                {a.time ? ` at ${a.time}` : ''}
              </p>
              {a.body_part && <p className="mt-1 text-sm text-muted">Body part: {a.body_part}</p>}
              {a.location && <p className="mt-1 text-sm text-muted">Location: {a.location}</p>}
              {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
              {a.first_aider && <p className="mt-1 text-sm text-muted">First aider: {a.first_aider}</p>}
              <div className="mt-3 flex gap-2">
                <button className="text-sm text-primary" onClick={() => openEdit(a)}>
                  Edit
                </button>
                <button
                  className="text-sm text-danger"
                  onClick={() => {
                    if (confirm('Delete this accident record?')) deleteAccident.mutate(a.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AccidentModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createAccident.isPending}
        onCreate={(data) => createAccident.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function AccidentModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Accident | null;
  onClose: () => void;
  onCreate: (data: AccidentCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateAccident = useUpdateAccident(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit accident' : 'Add accident'}>
      <AccidentForm
        initial={editing ?? undefined}
        submitting={editing ? updateAccident.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateAccident.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

function AccidentForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Accident;
  onSubmit: (data: AccidentCreateInput) => void;
  submitting?: boolean;
}) {
  const { data: children } = useChildren();

  const [childId, setChildId] = useState<number | ''>('');
  const [childName, setChildName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [injuryType, setInjuryType] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [firstAidGiven, setFirstAidGiven] = useState('');
  const [firstAider, setFirstAider] = useState('');
  const [witness, setWitness] = useState('');
  const [parentNotifiedAt, setParentNotifiedAt] = useState('');
  const [followUp, setFollowUp] = useState('');

  useEffect(() => {
    setChildId(initial?.child_id ?? '');
    setChildName(initial?.child_name ?? '');
    setDate(initial?.date ?? '');
    setTime(initial?.time ?? '');
    setLocation(initial?.location ?? '');
    setDescription(initial?.description ?? '');
    setInjuryType(initial?.injury_type ?? '');
    setBodyPart(initial?.body_part ?? '');
    setFirstAidGiven(initial?.first_aid_given ?? '');
    setFirstAider(initial?.first_aider ?? '');
    setWitness(initial?.witness ?? '');
    setParentNotifiedAt(initial?.parent_notified_at ?? '');
    setFollowUp(initial?.follow_up ?? '');
  }, [initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Keep the denormalised child_name in sync with the selected child.
    const selectedName =
      childId !== '' ? (children ?? []).find((c) => c.id === childId)?.name : undefined;
    onSubmit({
      childId: childId === '' ? undefined : childId,
      childName: selectedName ?? (childName || undefined),
      date: date || undefined,
      time: time || undefined,
      location: location || undefined,
      description: description || undefined,
      injuryType: injuryType || undefined,
      bodyPart: bodyPart || undefined,
      firstAidGiven: firstAidGiven || undefined,
      firstAider: firstAider || undefined,
      witness: witness || undefined,
      parentNotifiedAt: parentNotifiedAt || undefined,
      followUp: followUp || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Child (optional)">
        <select
          className="input"
          value={childId}
          onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">No specific child</option>
          {(children ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {childId === '' && (
        <Field label="Child name (if not listed)">
          <input className="input" value={childName} onChange={(e) => setChildName(e.target.value)} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time">
          <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Injury type">
          <input className="input" value={injuryType} onChange={(e) => setInjuryType(e.target.value)} />
        </Field>
        <Field label="Body part">
          <input className="input" value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} />
        </Field>
      </div>
      <Field label="Location">
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <Field label="Description">
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="First aid given">
        <input className="input" value={firstAidGiven} onChange={(e) => setFirstAidGiven(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="First aider">
          <input className="input" value={firstAider} onChange={(e) => setFirstAider(e.target.value)} />
        </Field>
        <Field label="Witness">
          <input className="input" value={witness} onChange={(e) => setWitness(e.target.value)} />
        </Field>
      </div>
      <Field label="Parent notified at">
        <input
          type="date"
          className="input"
          value={parentNotifiedAt}
          onChange={(e) => setParentNotifiedAt(e.target.value)}
        />
      </Field>
      <Field label="Follow up">
        <input className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
