import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { IncidentCreateInput } from '@sprout/schemas';
import {
  useIncidents,
  useCreateIncident,
  useUpdateIncident,
  useDeleteIncident,
  type Incident,
} from '../features/incidents/useIncidents';
import { useChildren } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/incidents')({
  component: IncidentsPage,
});

function IncidentsPage() {
  const { data: incidents, isLoading } = useIncidents();
  const createIncident = useCreateIncident();
  const deleteIncident = useDeleteIncident();

  const [editing, setEditing] = useState<Incident | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (i: Incident) => {
    setEditing(i);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Incidents</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add incident
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (incidents ?? []).length === 0 ? (
        <EmptyState title="No incidents found" description="Add an incident to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(incidents ?? []).map((i) => (
            <div key={i.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{i.type || 'Incident'}</h2>
                <Badge variant={i.parent_informed ? 'success' : 'warning'}>
                  {i.parent_informed ? 'Parent informed' : 'Parent not informed'}
                </Badge>
              </div>
              {i.child_name && <p className="mt-1 text-sm text-muted">Child: {i.child_name}</p>}
              <p className="mt-1 text-sm text-muted">
                {i.date}
                {i.time ? ` at ${i.time}` : ''}
              </p>
              {i.location && <p className="mt-1 text-sm text-muted">Location: {i.location}</p>}
              {i.description && <p className="mt-1 text-sm text-muted">{i.description}</p>}
              {i.reported_by && <p className="mt-1 text-sm text-muted">Reported by: {i.reported_by}</p>}
              <div className="mt-3 flex gap-2">
                <button className="text-sm text-primary" onClick={() => openEdit(i)}>
                  Edit
                </button>
                <button
                  className="text-sm text-danger"
                  onClick={() => {
                    if (confirm('Delete this incident?')) deleteIncident.mutate(i.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <IncidentModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createIncident.isPending}
        onCreate={(data) => createIncident.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function IncidentModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Incident | null;
  onClose: () => void;
  onCreate: (data: IncidentCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateIncident = useUpdateIncident(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit incident' : 'Add incident'}>
      <IncidentForm
        initial={editing ?? undefined}
        submitting={editing ? updateIncident.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateIncident.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

function IncidentForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Incident;
  onSubmit: (data: IncidentCreateInput) => void;
  submitting?: boolean;
}) {
  const { data: children } = useChildren();

  const [childId, setChildId] = useState<number | ''>('');
  const [childName, setChildName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [witness, setWitness] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [parentInformed, setParentInformed] = useState(false);
  const [parentInformedAt, setParentInformedAt] = useState('');
  const [signedBy, setSignedBy] = useState('');

  useEffect(() => {
    setChildId(initial?.child_id ?? '');
    setChildName(initial?.child_name ?? '');
    setDate(initial?.date ?? '');
    setTime(initial?.time ?? '');
    setType(initial?.type ?? '');
    setLocation(initial?.location ?? '');
    setDescription(initial?.description ?? '');
    setActionTaken(initial?.action_taken ?? '');
    setWitness(initial?.witness ?? '');
    setReportedBy(initial?.reported_by ?? '');
    setParentInformed(initial?.parent_informed ?? false);
    setParentInformedAt(initial?.parent_informed_at ?? '');
    setSignedBy(initial?.signed_by ?? '');
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
      type: type || undefined,
      location: location || undefined,
      description: description || undefined,
      actionTaken: actionTaken || undefined,
      witness: witness || undefined,
      reportedBy: reportedBy || undefined,
      parentInformed,
      parentInformedAt: parentInformedAt || undefined,
      signedBy: signedBy || undefined,
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
      <Field label="Type">
        <input className="input" value={type} onChange={(e) => setType(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time">
          <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Location">
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <Field label="Description">
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Action taken">
        <input className="input" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Witness">
          <input className="input" value={witness} onChange={(e) => setWitness(e.target.value)} />
        </Field>
        <Field label="Reported by">
          <input className="input" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={parentInformed}
          onChange={(e) => setParentInformed(e.target.checked)}
        />
        Parent informed
      </label>
      {parentInformed && (
        <Field label="Parent informed at">
          <input
            type="date"
            className="input"
            value={parentInformedAt}
            onChange={(e) => setParentInformedAt(e.target.value)}
          />
        </Field>
      )}
      <Field label="Signed by">
        <input className="input" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
