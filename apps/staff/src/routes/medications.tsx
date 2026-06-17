import { useMemo, useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { MedicationCreateInput } from '@sprout/schemas';
import {
  useMedications,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
  type Medication,
} from '../features/medications/useMedications';
import { useChildren, type Child } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge, StatCard } from '../components/ui';

export const Route = createFileRoute('/medications')({
  component: MedicationsPage,
});

// ── Status helpers ──────────────────────────────────────────────────────
// The API stores lowercase statuses (active/completed/refused, default
// 'active'). The reference app uses Pending/Given/Refused; we map onto the
// real values here and colour the badge accordingly.
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const STATUS_OPTIONS = ['active', 'completed', 'refused'] as const;

function statusVariant(status: string): BadgeVariant {
  switch ((status || 'active').toLowerCase()) {
    case 'completed':
      return 'success';
    case 'refused':
      return 'danger';
    case 'active':
      return 'warning';
    default:
      return 'muted';
  }
}

function statusLabel(status: string): string {
  const s = (status || 'active').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Avatar helpers (mirrors reference app's `clr` / `ini`) ──────────────
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#4f46e5,#818cf8)',
  'linear-gradient(135deg,#059669,#34d399)',
  'linear-gradient(135deg,#d97706,#fbbf24)',
  'linear-gradient(135deg,#dc2626,#f87171)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
  'linear-gradient(135deg,#ea580c,#fb923c)',
  'linear-gradient(135deg,#db2777,#f472b6)',
];

function avatarGradient(name: string): string {
  const a = name.charCodeAt(0) || 0;
  const b = name.charCodeAt(1) || 0;
  return AVATAR_GRADIENTS[(a + b) % AVATAR_GRADIENTS.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function ChildAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-bold text-white"
      style={{ backgroundImage: avatarGradient(name || '?') }}
    >
      {initials(name || '?')}
    </div>
  );
}

function MedicationsPage() {
  const { data: meds, isLoading } = useMedications();
  const { data: children } = useChildren();
  const createMed = useCreateMedication();
  const deleteMed = useDeleteMedication();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<Medication | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // child_id → name lookup so MAR rows can show the child name (the API
  // medications row does not embed child_name).
  const childName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of children ?? []) map.set(c.id, c.name);
    return map;
  }, [children]);

  const nameFor = (m: Medication) => childName.get(m.child_id) ?? `Child #${m.child_id}`;

  const filtered = useMemo(
    () =>
      (meds ?? []).filter((m) => {
        const name = nameFor(m).toLowerCase();
        return (
          (!search ||
            name.includes(search.toLowerCase()) ||
            m.medication_name.toLowerCase().includes(search.toLowerCase())) &&
          (!statusFilter || (m.status || 'active').toLowerCase() === statusFilter)
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meds, search, statusFilter, childName],
  );

  // Stat tiles (mirror the reference's Awaiting / Given / Refused cards).
  const counts = useMemo(() => {
    const c = { active: 0, completed: 0, refused: 0 };
    for (const m of meds ?? []) {
      const s = (m.status || 'active').toLowerCase();
      if (s === 'completed') c.completed++;
      else if (s === 'refused') c.refused++;
      else c.active++;
    }
    return c;
  }, [meds]);

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

      {!isLoading && (meds ?? []).length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Active" value={counts.active} />
          <StatCard label="Given / completed" value={counts.completed} />
          <StatCard label="Refused" value={counts.refused} />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search child or medicine…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-[10rem]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No medication records found"
          description="Add a medication administration record or adjust your filters."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Medication</th>
                <th className="px-4 py-2 font-medium">Dose</th>
                <th className="px-4 py-2 font-medium">Frequency</th>
                <th className="px-4 py-2 font-medium">Given by / witness</th>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((m) => {
                const name = nameFor(m);
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <ChildAvatar name={name} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-gray-900">{name}</div>
                          {m.prescribed_by && (
                            <div className="text-xs text-muted">Rx: {m.prescribed_by}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">💊 {m.medication_name}</div>
                      {m.route && <div className="text-xs text-muted">{m.route}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-gray-900">{m.dose || '—'}</div>
                      {m.dose_given && (
                        <div className="text-xs font-semibold text-success">
                          Given: {m.dose_given}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted">{m.frequency || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="text-gray-900">{m.given_by || '—'}</div>
                      {m.witness_by && (
                        <div className="text-xs text-muted">Witness: {m.witness_by}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted">{m.time_given || '—'}</td>
                    <td className="px-4 py-2">
                      <Badge variant={statusVariant(m.status)}>{statusLabel(m.status)}</Badge>
                      {m.status?.toLowerCase() === 'refused' && m.refused_reason && (
                        <div className="mt-1 text-xs font-medium text-danger">
                          {m.refused_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button className="text-sm text-primary" onClick={() => openEdit(m)}>
                        Edit
                      </button>
                      <button
                        className="ml-3 text-sm text-danger"
                        onClick={() => {
                          if (confirm(`Delete medication record for ${name}?`))
                            deleteMed.mutate(m.id);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MedicationModal
        open={modalOpen}
        editing={editing}
        children={children ?? []}
        onClose={() => setModalOpen(false)}
        createSubmitting={createMed.isPending}
        onCreate={(data) => createMed.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Add/edit modal. Edit uses a per-record update mutation hook.
function MedicationModal({
  open,
  editing,
  children,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Medication | null;
  children: Child[];
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
        children={children}
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
  children,
  onSubmit,
  submitting,
}: {
  initial?: Medication;
  children: Child[];
  onSubmit: (data: MedicationCreateInput) => void;
  submitting?: boolean;
}) {
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

  // Allergy warning for the selected child (mirrors refreshAllergyBanner).
  const selectedChild = children.find((c) => c.id === childId);
  const allergy = (selectedChild?.allergy ?? '').trim();
  const showAllergy = allergy !== '' && allergy.toLowerCase() !== 'none';

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
      {showAllergy && (
        <div
          role="alert"
          className="rounded-lg border-2 border-danger/40 bg-danger-light px-3 py-2 text-sm font-bold text-danger"
        >
          ⚠️ Allergy: {allergy} — check before administering.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Child">
          <select
            className="input"
            value={childId}
            onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select a child…</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Medication name">
        <input
          className="input"
          value={medicationName}
          placeholder="e.g. Calpol, Piriton, Epipen"
          onChange={(e) => setMedicationName(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Dose (prescribed)">
          <input
            className="input"
            value={dose}
            placeholder="e.g. 5ml"
            onChange={(e) => setDose(e.target.value)}
          />
        </Field>
        <Field label="Dose given">
          <input className="input" value={doseGiven} onChange={(e) => setDoseGiven(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Frequency">
          <input
            className="input"
            value={frequency}
            placeholder="e.g. Twice daily"
            onChange={(e) => setFrequency(e.target.value)}
          />
        </Field>
        <Field label="Route / method">
          <input
            className="input"
            value={route}
            placeholder="e.g. Oral, Inhaler"
            onChange={(e) => setRoute(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Prescribed by">
        <input
          className="input"
          value={prescribedBy}
          placeholder="GP / parent"
          onChange={(e) => setPrescribedBy(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date">
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Administration record: who gave it, who witnessed, time given.
            TODO: needs a /staff endpoint to offer staff pickers here instead
            of free-text (reference populates these from API.get('/staff')). */}
        <Field label="Given by">
          <input className="input" value={givenBy} onChange={(e) => setGivenBy(e.target.value)} />
        </Field>
        <Field label="Witness by">
          <input className="input" value={witnessBy} onChange={(e) => setWitnessBy(e.target.value)} />
        </Field>
      </div>

      <Field label="Time given">
        <input
          type="time"
          className="input"
          value={timeGiven}
          onChange={(e) => setTimeGiven(e.target.value)}
        />
      </Field>

      {status === 'refused' && (
        <Field label="Refusal reason">
          <input
            className="input"
            value={refusedReason}
            onChange={(e) => setRefusedReason(e.target.value)}
          />
        </Field>
      )}

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
