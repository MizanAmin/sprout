import { useMemo, useState, useEffect } from 'react';
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
import { Modal, Field, Spinner, EmptyState, Badge, StatCard } from '../components/ui';

export const Route = createFileRoute('/accident-book')({
  component: AccidentBookPage,
});

// Injury types (mirrors the reference app's INJURY_TYPES list).
const INJURY_TYPES = [
  'Bump / Bruise',
  'Cut / Graze',
  'Burn',
  'Fracture / Break',
  'Bite',
  'Allergic Reaction',
  'Other',
] as const;

// Location options (mirrors the reference app's LOCATIONS list).
const LOCATIONS = [
  'Garden / Outdoor Area',
  'Main Room',
  'Corridor / Hallway',
  'Bathroom',
  'Kitchen',
  'Entrance / Reception',
  'On Outing',
  'Other',
] as const;

// Colour-code injury types onto the shared Badge variants (the reference uses
// per-type colours via INJURY_COLOR).
const INJURY_BADGE: Record<string, 'warning' | 'danger' | 'info' | 'muted'> = {
  'Bump / Bruise': 'warning',
  'Cut / Graze': 'danger',
  Burn: 'danger',
  'Fracture / Break': 'danger',
  Bite: 'info',
  'Allergic Reaction': 'warning',
  Other: 'muted',
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

const today = () => new Date().toISOString().split('T')[0];

function AccidentBookPage() {
  const { data: accidents, isLoading } = useAccidentBook();
  const createAccident = useCreateAccident();
  const deleteAccident = useDeleteAccident();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Accident | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const all = accidents ?? [];

  // Stat counts (mirrors the reference stats-grid: total, parent pending,
  // parent notified, today). The reference also tracks RIDDOR, but the accident
  // schema (migration 003) has no riddor column.
  // TODO: needs a `riddor` column on accident_book + /accident-book/stats to
  // surface a "RIDDOR Required" stat like the reference app.
  const stats = useMemo(() => {
    const t = today();
    return {
      total: all.length,
      pending: all.filter((a) => !a.parent_notified_at).length,
      notified: all.filter((a) => !!a.parent_notified_at).length,
      today: all.filter((a) => a.date === t).length,
    };
  }, [all]);

  const filtered = all.filter((a) => {
    const matchSearch =
      !search || (a.child_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      !filter ||
      (filter === 'pending' && !a.parent_notified_at) ||
      (filter === 'notified' && !!a.parent_notified_at) ||
      (filter === 'today' && a.date === today());
    return matchSearch && matchFilter;
  });

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
          Record accident
        </button>
      </div>

      {/* Stat cards (mirrors the reference stats-grid). Clicking filters the table. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total records" value={stats.total} onClick={() => setFilter('')} />
        <StatCard
          label="Parent pending"
          value={stats.pending}
          onClick={() => setFilter((cur) => (cur === 'pending' ? '' : 'pending'))}
        />
        <StatCard
          label="Parent notified"
          value={stats.notified}
          onClick={() => setFilter((cur) => (cur === 'notified' ? '' : 'notified'))}
        />
        <StatCard
          label="Today"
          value={stats.today}
          onClick={() => setFilter((cur) => (cur === 'today' ? '' : 'today'))}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search child…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-[12rem]"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All records</option>
          <option value="pending">Parent pending</option>
          <option value="notified">Parent notified</option>
          <option value="today">Today</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No accident records found"
          description='Click "Record accident" to log a new entry, or adjust your filters.'
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Date / Time</th>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Nature of injury</th>
                <th className="px-4 py-2 font-medium">Treatment</th>
                <th className="px-4 py-2 font-medium">Parent</th>
                <th className="px-4 py-2 font-medium">First aider</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => (
                <tr key={a.id} className="align-top hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                    <div className="font-semibold">{a.date || '—'}</div>
                    {a.time && <div className="text-xs text-muted">{a.time}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ChildAvatar name={a.child_name} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-gray-900">
                          {a.child_name || '—'}
                        </div>
                        {a.location && <div className="text-xs text-muted">{a.location}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {a.injury_type ? (
                      <Badge variant={INJURY_BADGE[a.injury_type] ?? 'muted'}>
                        {a.injury_type}
                      </Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {a.body_part && <div className="mt-1 text-xs text-muted">{a.body_part}</div>}
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-muted">
                    {a.first_aid_given || a.description || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={a.parent_notified_at ? 'success' : 'warning'}>
                      {a.parent_notified_at ? 'Notified' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{a.first_aider || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(a)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm('Delete this accident record?')) deleteAccident.mutate(a.id);
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

// Add/edit modal. Edit uses a per-record update mutation hook.
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
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit accident record' : 'Record accident'}
    >
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
  const [injuryType, setInjuryType] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [description, setDescription] = useState('');
  const [firstAidGiven, setFirstAidGiven] = useState('');
  const [firstAider, setFirstAider] = useState('');
  const [witness, setWitness] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [parentNotified, setParentNotified] = useState(false);
  const [parentNotifiedAt, setParentNotifiedAt] = useState('');

  useEffect(() => {
    setChildId(initial?.child_id ?? '');
    setChildName(initial?.child_name ?? '');
    setDate(initial?.date ?? '');
    setTime(initial?.time ?? '');
    setLocation(initial?.location ?? '');
    setInjuryType(initial?.injury_type ?? '');
    setBodyPart(initial?.body_part ?? '');
    setDescription(initial?.description ?? '');
    setFirstAidGiven(initial?.first_aid_given ?? '');
    setFirstAider(initial?.first_aider ?? '');
    setWitness(initial?.witness ?? '');
    setFollowUp(initial?.follow_up ?? '');
    setParentNotified(!!initial?.parent_notified_at);
    setParentNotifiedAt(initial?.parent_notified_at ?? '');
  }, [initial]);

  // Surface the selected child's allergy as a banner (mirrors the reference's
  // allergy banner shown in injury-related modals).
  const selectedChild =
    childId !== '' ? (children ?? []).find((c) => c.id === childId) : undefined;
  const allergy = (selectedChild?.allergy ?? '').trim();
  const hasAllergy = allergy !== '' && allergy.toLowerCase() !== 'none';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (childId === '' && !childName.trim()) {
      alert('Select a child or enter a name');
      return;
    }
    if (!description.trim()) {
      alert('Please describe how the accident happened');
      return;
    }
    // Keep the denormalised child_name in sync with the selected child.
    const selectedName = selectedChild?.name;
    onSubmit({
      childId: childId === '' ? undefined : childId,
      childName: selectedName ?? (childName || undefined),
      date: date || undefined,
      time: time || undefined,
      location: location || undefined,
      injuryType: injuryType || undefined,
      bodyPart: bodyPart || undefined,
      description: description || undefined,
      firstAidGiven: firstAidGiven || undefined,
      firstAider: firstAider || undefined,
      witness: witness || undefined,
      followUp: followUp || undefined,
      parentNotifiedAt: parentNotified ? parentNotifiedAt || undefined : undefined,
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

      {childId === '' && (
        <Field label="Child name (if not listed)">
          <input
            className="input"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Date of accident">
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Time of accident">
          <input
            type="time"
            className="input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Location in nursery">
          <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">— Select —</option>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nature of injury">
          <select
            className="input"
            value={injuryType}
            onChange={(e) => setInjuryType(e.target.value)}
          >
            <option value="">— Select —</option>
            {INJURY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Body part affected">
        {/* The reference app marks injury location(s) on an interactive front/back
            body diagram (body_markers JSON). The accident schema only has a free
            text `body_part` column, so this is a text field.
            TODO: needs a `body_markers` column on accident_book + a body-diagram
            component to replicate the reference's clickable diagram. */}
        <input
          className="input"
          value={bodyPart}
          onChange={(e) => setBodyPart(e.target.value)}
          placeholder="e.g. Left knee, Forehead"
        />
      </Field>

      <Field label="How did the accident happen?">
        <textarea
          className="input min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what happened, including any contributing factors…"
        />
      </Field>

      <Field label="Treatment given / first aid administered">
        <textarea
          className="input min-h-[60px]"
          value={firstAidGiven}
          onChange={(e) => setFirstAidGiven(e.target.value)}
          placeholder="e.g. cold compress applied, wound cleaned and dressed…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="First aider / treating staff">
          {/* TODO: the reference populates this from a /staff list; the staff app
              exposes no staff endpoint, so this stays a free-text input. */}
          <input
            className="input"
            value={firstAider}
            onChange={(e) => setFirstAider(e.target.value)}
          />
        </Field>
        <Field label="Witnessed by">
          <input className="input" value={witness} onChange={(e) => setWitness(e.target.value)} />
        </Field>
      </div>

      <Field label="Follow-up action required">
        <input
          className="input"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          placeholder="e.g. Monitor for 24h, hospital if worsens"
        />
      </Field>

      {/* Parent / carer notification (mirrors the reference notification panel). */}
      <div className="rounded-lg border border-border bg-gray-50 p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
          Parent / carer notification
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={parentNotified}
            onChange={(e) => setParentNotified(e.target.checked)}
          />
          Parent notified
        </label>
        {parentNotified && (
          <div className="mt-3">
            <Field label="Date notified">
              {/* The reference also records the time and method (In Person / Phone /
                  Text / Email). The accident schema only has `parent_notified_at`.
                  TODO: needs `parent_notified_how` (+ time) columns on
                  accident_book to capture the notification method like the reference. */}
              <input
                type="date"
                className="input"
                value={parentNotifiedAt}
                onChange={(e) => setParentNotifiedAt(e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      {/* TODO: the reference modal also captures a "RIDDOR reportable?" flag and
          staff + parent signatures (staff_signature / parent_signature /
          signer names). The accident schema (migration 003) has no riddor or
          signature columns — needs a schema + /accident-book migration. */}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
