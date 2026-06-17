import { useMemo, useState } from 'react';
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
import { useStaff } from '../features/staff/useStaff';
import { Modal, Field, Spinner, EmptyState, Badge, StatCard } from '../components/ui';

export const Route = createFileRoute('/reflections')({
  component: ReflectionsPage,
});

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

function ReflectionsPage() {
  const { data: reflections, isLoading } = useReflections();
  const { data: children } = useChildren();
  const createReflection = useCreateReflection();
  const deleteReflection = useDeleteReflection();

  const [search, setSearch] = useState('');
  const [childFilter, setChildFilter] = useState('');
  const [editing, setEditing] = useState<Reflection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const childName = (id: number) => children?.find((c) => c.id === id)?.name ?? `Child #${id}`;

  const rows = reflections ?? [];

  // Summary counts (mirrors reference stat cards). Reflections table has no
  // `type` column, so we surface counts by recency instead.
  const stats = useMemo(() => {
    const total = rows.length;
    const withNextSteps = rows.filter((r) => !!r.next_steps?.trim()).length;
    const children = new Set(rows.map((r) => r.child_id)).size;
    const now = new Date();
    const thisMonth = rows.filter((r) => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    return { total, withNextSteps, children, thisMonth };
  }, [rows]);

  const filtered = rows.filter((r) => {
    const name = childName(r.child_id).toLowerCase();
    const haystack = [
      name,
      r.what_went_well ?? '',
      r.areas_for_development ?? '',
      r.next_steps ?? '',
      r.practitioner ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return (
      (!search || haystack.includes(search.toLowerCase())) &&
      (!childFilter || String(r.child_id) === childFilter)
    );
  });

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

      {!isLoading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Reflections" value={stats.total} />
          <StatCard label="Children covered" value={stats.children} />
          <StatCard label="With next steps" value={stats.withNextSteps} />
          <StatCard label="This month" value={stats.thisMonth} />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search reflections…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-[14rem]"
          value={childFilter}
          onChange={(e) => setChildFilter(e.target.value)}
        >
          <option value="">All children</option>
          {(children ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No reflections yet"
          description={
            rows.length === 0
              ? 'Add your first practitioner reflection to get started.'
              : 'No reflections match your filters.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((r) => (
            <ReflectionCard
              key={r.id}
              reflection={r}
              childName={childName(r.child_id)}
              onEdit={() => openEdit(r)}
              onDelete={() => {
                if (confirm(`Delete this reflection for ${childName(r.child_id)}?`))
                  deleteReflection.mutate(r.id);
              }}
            />
          ))}
        </div>
      )}

      <ReflectionModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createReflection.isPending}
        onCreate={(data) => createReflection.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Single colored reflection section (what went well / areas / next steps),
// mirroring the reference app's tinted outcome panels.
function ReflectionSection({
  label,
  text,
  tone,
}: {
  label: string;
  text: string | null;
  tone: 'success' | 'warning' | 'info';
}) {
  if (!text?.trim()) return null;
  const tones: Record<typeof tone, string> = {
    success: 'bg-success-light',
    warning: 'bg-warning-light',
    info: 'bg-info-light',
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${tones[tone]}`}>
      <Badge variant={tone}>{label}</Badge>
      <p className="mt-1.5 whitespace-pre-line text-sm text-gray-700">{text}</p>
    </div>
  );
}

function ReflectionCard({
  reflection: r,
  childName,
  onEdit,
  onDelete,
}: {
  reflection: Reflection;
  childName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
            style={{ backgroundImage: avatarGradient(childName) }}
          >
            {initials(childName)}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">{childName}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {[r.date, r.practitioner].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button className="btn-outline btn-sm" onClick={onEdit} aria-label="Edit reflection">
            Edit
          </button>
          <button
            className="btn-outline btn-sm text-danger"
            onClick={onDelete}
            aria-label="Delete reflection"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        <ReflectionSection label="What went well" text={r.what_went_well} tone="success" />
        <ReflectionSection
          label="Areas for development"
          text={r.areas_for_development}
          tone="warning"
        />
        <ReflectionSection label="Next steps" text={r.next_steps} tone="info" />
        {!r.what_went_well?.trim() &&
          !r.areas_for_development?.trim() &&
          !r.next_steps?.trim() && (
            <p className="text-sm text-muted">No reflection notes recorded.</p>
          )}
      </div>
    </div>
  );
}

// Add/edit modal. Edit uses a per-reflection update mutation hook.
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
  const { data: staff } = useStaff();
  const [childId, setChildId] = useState<number | ''>(initial?.child_id ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [whatWentWell, setWhatWentWell] = useState(initial?.what_went_well ?? '');
  const [areasForDevelopment, setAreasForDevelopment] = useState(
    initial?.areas_for_development ?? '',
  );
  const [nextSteps, setNextSteps] = useState(initial?.next_steps ?? '');
  const [practitioner, setPractitioner] = useState(initial?.practitioner ?? '');

  // Build the dropdown options from staff names, appending the current value as
  // an extra option when it's legacy free text not matching any staff name (so
  // editing an existing reflection doesn't silently drop the saved value).
  const staffNames = (staff ?? []).map((s) => s.name);
  const practitionerOptions =
    practitioner && !staffNames.includes(practitioner)
      ? [practitioner, ...staffNames]
      : staffNames;

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
      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <Field label="What went well">
        <textarea
          className="input"
          rows={3}
          value={whatWentWell}
          onChange={(e) => setWhatWentWell(e.target.value)}
          placeholder="Strengths and successes observed…"
        />
      </Field>

      <Field label="Areas for development">
        <textarea
          className="input"
          rows={3}
          value={areasForDevelopment}
          onChange={(e) => setAreasForDevelopment(e.target.value)}
          placeholder="What could be improved…"
        />
      </Field>

      <Field label="Next steps">
        <textarea
          className="input"
          rows={3}
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
          placeholder="Planned actions for future practice…"
        />
      </Field>

      <Field label="Practitioner">
        <select
          className="input"
          value={practitioner}
          onChange={(e) => setPractitioner(e.target.value)}
        >
          <option value="">— Select —</option>
          {practitionerOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
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
