import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { MedicationCreateInput } from '@sprout/schemas';
import {
  useMedications,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
  type Medication,
} from '../features/medications/useMedications';
import { useChildren } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/medications')({
  component: MedicationsPage,
});

function MedicationsPage() {
  const { data: meds, isLoading } = useMedications();
  const createMed = useCreateMedication();
  const deleteMed = useDeleteMedication();

  const [editing, setEditing] = useState<Medication | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (m: Medication) => {
    setEditing(m);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Medications</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add medication
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (meds ?? []).length === 0 ? (
        <EmptyState
          title="No medication records found"
          description="Add a medication record to get started."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(meds ?? []).map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{m.medication_name}</h2>
                <Badge variant={m.status === 'active' ? 'success' : 'muted'}>
                  {m.status || 'active'}
                </Badge>
              </div>
              {m.dose && <p className="mt-1 text-sm text-muted">Dose: {m.dose}</p>}
              {m.frequency && <p className="mt-1 text-sm text-muted">Frequency: {m.frequency}</p>}
              {m.route && <p className="mt-1 text-sm text-muted">Route: {m.route}</p>}
              {m.given_by && <p className="mt-1 text-sm text-muted">Given by: {m.given_by}</p>}
              {(m.start_date || m.end_date) && (
                <p className="mt-1 text-sm text-muted">
                  {m.start_date ?? '—'} → {m.end_date ?? '—'}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button className="text-sm text-primary" onClick={() => openEdit(m)}>
                  Edit
                </button>
                <button
                  className="text-sm text-danger"
                  onClick={() => {
                    if (confirm(`Delete ${m.medication_name}?`)) deleteMed.mutate(m.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MedicationModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createMed.isPending}
        onCreate={(data) => createMed.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function MedicationModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Medication | null;
  onClose: () => void;
  onCreate: (data: MedicationCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateMed = useUpdateMedication(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.medication_name}` : 'Add medication'}
    >
      <MedicationForm
        initial={editing ?? undefined}
        submitting={editing ? updateMed.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateMed.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

function MedicationForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Medication;
  onSubmit: (data: MedicationCreateInput) => void;
  submitting?: boolean;
}) {
  const { data: children } = useChildren();

  const [childId, setChildId] = useState<number | ''>('');
  const [medicationName, setMedicationName] = useState('');
  const [dose, setDose] = useState('');
  const [doseGiven, setDoseGiven] = useState('');
  const [frequency, setFrequency] = useState('');
  const [route, setRoute] = useState('');
  const [prescribedBy, setPrescribedBy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [givenBy, setGivenBy] = useState('');
  const [witnessBy, setWitnessBy] = useState('');
  const [timeGiven, setTimeGiven] = useState('');
  const [refusedReason, setRefusedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');

  useEffect(() => {
    setChildId(initial?.child_id ?? '');
    setMedicationName(initial?.medication_name ?? '');
    setDose(initial?.dose ?? '');
    setDoseGiven(initial?.dose_given ?? '');
    setFrequency(initial?.frequency ?? '');
    setRoute(initial?.route ?? '');
    setPrescribedBy(initial?.prescribed_by ?? '');
    setStartDate(initial?.start_date ?? '');
    setEndDate(initial?.end_date ?? '');
    setGivenBy(initial?.given_by ?? '');
    setWitnessBy(initial?.witness_by ?? '');
    setTimeGiven(initial?.time_given ?? '');
    setRefusedReason(initial?.refused_reason ?? '');
    setNotes(initial?.notes ?? '');
    setStatus(initial?.status ?? 'active');
    setError('');
  }, [initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (childId === '') {
      setError('Please select a child.');
      return;
    }
    if (!medicationName.trim()) {
      setError('Medication name is required.');
      return;
    }
    onSubmit({
      childId,
      medicationName: medicationName.trim(),
      dose: dose || undefined,
      doseGiven: doseGiven || undefined,
      frequency: frequency || undefined,
      route: route || undefined,
      prescribedBy: prescribedBy || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      givenBy: givenBy || undefined,
      witnessBy: witnessBy || undefined,
      timeGiven: timeGiven || undefined,
      refusedReason: refusedReason || undefined,
      notes: notes || undefined,
      status: status || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Child">
        <select
          className="input"
          value={childId}
          onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select a child…</option>
          {(children ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Medication name">
        <input className="input" value={medicationName} onChange={(e) => setMedicationName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Dose">
          <input className="input" value={dose} onChange={(e) => setDose(e.target.value)} />
        </Field>
        <Field label="Dose given">
          <input className="input" value={doseGiven} onChange={(e) => setDoseGiven(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Frequency">
          <input className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
        </Field>
        <Field label="Route">
          <input className="input" value={route} onChange={(e) => setRoute(e.target.value)} />
        </Field>
      </div>
      <Field label="Prescribed by">
        <input className="input" value={prescribedBy} onChange={(e) => setPrescribedBy(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date">
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date">
          <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Given by">
          <input className="input" value={givenBy} onChange={(e) => setGivenBy(e.target.value)} />
        </Field>
        <Field label="Witness by">
          <input className="input" value={witnessBy} onChange={(e) => setWitnessBy(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Time given">
          <input type="time" className="input" value={timeGiven} onChange={(e) => setTimeGiven(e.target.value)} />
        </Field>
        <Field label="Status">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">active</option>
            <option value="completed">completed</option>
            <option value="refused">refused</option>
          </select>
        </Field>
      </div>
      <Field label="Refused reason">
        <input className="input" value={refusedReason} onChange={(e) => setRefusedReason(e.target.value)} />
      </Field>
      <Field label="Notes">
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
