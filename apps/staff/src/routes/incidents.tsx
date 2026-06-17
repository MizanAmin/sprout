import { useMemo, useState, useEffect } from 'react';
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
import { useStaff } from '../features/staff/useStaff';
import { Modal, Field, Spinner, EmptyState, Badge, StatCard } from '../components/ui';

export const Route = createFileRoute('/incidents')({
  component: IncidentsPage,
});

// Incident types (mirrors the reference app's type list). The reference also
// colour-codes each type; here we map them onto the shared Badge variants.
const INCIDENT_TYPES = ['Accident', 'Incident', 'Near Miss', 'Safeguarding'] as const;

const TYPE_BADGE: Record<string, 'warning' | 'danger' | 'info' | 'muted'> = {
  Accident: 'warning',
  Incident: 'danger',
  'Near Miss': 'info',
  Safeguarding: 'muted',
};

// ── Avatar helpers (mirrors reference app's `clr` / `ini`) ──────────────
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#4f46e5,#818cf8)',
  'linear-gradient(135deg,#059669,#34d399)',
  'linear-gradient(135deg,#d97706,#fbbf24)',
  'linear-gradient(135deg,#dc2626,#f87171)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
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
  const label = name?.trim() || '—';
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
      style={{ backgroundImage: avatarGradient(label) }}
    >
      {initials(label) || '?'}
    </div>
  );
}

function IncidentsPage() {
  const { data: incidents, isLoading } = useIncidents();
  const createIncident = useCreateIncident();
  const deleteIncident = useDeleteIncident();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [parentFilter, setParentFilter] = useState('');
  const [editing, setEditing] = useState<Incident | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const all = incidents ?? [];

  // Stat counts per type (mirrors the reference stats-grid).
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of all) map.set(i.type, (map.get(i.type) ?? 0) + 1);
    return map;
  }, [all]);

  const filtered = all.filter(
    (i) =>
      (!search || i.child_name.toLowerCase().includes(search.toLowerCase())) &&
      (!typeFilter || i.type === typeFilter) &&
      (!parentFilter ||
        (parentFilter === 'informed' ? i.parent_informed : !i.parent_informed)),
  );

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
          Log incident
        </button>
      </div>

      {/* Stat cards by type — clicking filters the table. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {INCIDENT_TYPES.map((t) => (
          <StatCard
            key={t}
            label={t}
            value={counts.get(t) ?? 0}
            onClick={() => setTypeFilter((cur) => (cur === t ? '' : t))}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search child…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-[10rem]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {INCIDENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[12rem]"
          value={parentFilter}
          onChange={(e) => setParentFilter(e.target.value)}
        >
          <option value="">All records</option>
          <option value="informed">Parent informed</option>
          <option value="pending">Parent not informed</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No incidents recorded"
          description="Log an incident or adjust your filters."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Date / Time</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Action taken</th>
                <th className="px-4 py-2 font-medium">Parent</th>
                <th className="px-4 py-2 font-medium">Recorded by</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((i) => (
                <tr key={i.id} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ChildAvatar name={i.child_name} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-gray-900">
                          {i.child_name || '—'}
                        </div>
                        {i.location && (
                          <div className="text-xs text-muted">{i.location}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                    <div className="font-medium">{i.date || '—'}</div>
                    {i.time && <div className="text-xs text-muted">{i.time}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={TYPE_BADGE[i.type] ?? 'muted'}>{i.type || 'Incident'}</Badge>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">{i.description || '—'}</td>
                  <td className="max-w-xs px-4 py-3 text-muted">{i.action_taken || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={i.parent_informed ? 'success' : 'warning'}>
                      {i.parent_informed ? 'Informed' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{i.reported_by || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(i)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm('Delete this incident?')) deleteIncident.mutate(i.id);
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

// Add/edit modal. Edit uses a per-incident update mutation hook.
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
    <Modal open={open} onClose={onClose} title={editing ? 'Edit incident' : 'Log incident'}>
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
  const { data: staff } = useStaff();
  const staffList = staff ?? [];

  const [childId, setChildId] = useState<number | ''>('');
  const [childName, setChildName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<string>(INCIDENT_TYPES[0]);
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
    setType(initial?.type || INCIDENT_TYPES[0]);
    setLocation(initial?.location ?? '');
    setDescription(initial?.description ?? '');
    setActionTaken(initial?.action_taken ?? '');
    setWitness(initial?.witness ?? '');
    setReportedBy(initial?.reported_by ?? '');
    setParentInformed(initial?.parent_informed ?? false);
    setParentInformedAt(initial?.parent_informed_at ?? '');
    setSignedBy(initial?.signed_by ?? '');
  }, [initial]);

  // Surface the selected child's allergy as a banner (mirrors the reference's
  // allergy banner inside the incident modal).
  const selectedChild =
    childId !== '' ? (children ?? []).find((c) => c.id === childId) : undefined;
  const allergy = (selectedChild?.allergy ?? '').trim();
  const hasAllergy = allergy !== '' && allergy.toLowerCase() !== 'none';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('Description is required');
      return;
    }
    // Keep the denormalised child_name in sync with the selected child.
    const selectedName = selectedChild?.name;
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
      parentInformedAt: parentInformed ? parentInformedAt || undefined : undefined,
      signedBy: signedBy || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasAllergy && (
        <div
          role="alert"
          className="rounded-lg border-2 border-danger/40 bg-danger-light px-3 py-2 text-sm font-bold text-danger"
        >
          ⚠️ Allergy on record: {allergy}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Child">
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
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

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

      <Field label="Location">
        <input
          className="input"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Outdoor Area, Hall"
        />
      </Field>

      {/* TODO: the reference modal also captures a "Body Part" field and a
          "RIDDOR reportable?" flag. The incidents table/schema (migration 003)
          has no body_part or riddor_required columns — needs a schema +
          /incidents migration to support them. */}

      <Field label="Description">
        <textarea
          className="input min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="Action taken">
        <textarea
          className="input min-h-[60px]"
          value={actionTaken}
          onChange={(e) => setActionTaken(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Recorded by">
          {/* Staff names are sourced from the /staff list via useStaff(). */}
          <select className="input" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)}>
            <option value="">— Select —</option>
            {reportedBy && !staffList.some((s) => s.name === reportedBy) && (
              <option value={reportedBy}>{reportedBy}</option>
            )}
            {staffList.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Witnessed by">
          <select className="input" value={witness} onChange={(e) => setWitness(e.target.value)}>
            <option value="">— Select —</option>
            {witness && !staffList.some((s) => s.name === witness) && (
              <option value={witness}>{witness}</option>
            )}
            {staffList.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Parent informed at">
            <input
              type="date"
              className="input"
              value={parentInformedAt}
              onChange={(e) => setParentInformedAt(e.target.value)}
            />
          </Field>
          <Field label="Signed by">
            <input className="input" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
