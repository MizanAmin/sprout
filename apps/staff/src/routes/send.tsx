import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useSend,
  useCreateSend,
  useUpdateSend,
  useDeleteSend,
  type SendFlag,
  type SendInput,
  type SendStatus,
} from '../features/send/useSend';
import { useChildren, type Child } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/send')({
  component: SendPage,
});

// ── Avatar helpers (mirror the reference app's `clr` / `ini`) ───────────────
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

// Status (Active / Monitoring / Resolved) drives the card accent + stat buckets.
const STATUS_LABEL: Record<SendStatus, string> = {
  active: 'Active',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

const STATUS_ACCENT: Record<SendStatus, string> = {
  active: 'var(--color-warning, #f59e0b)',
  monitoring: 'var(--color-info, #3b82f6)',
  resolved: 'var(--color-success, #22c55e)',
};

const STATUS_BADGE: Record<SendStatus, 'warning' | 'info' | 'success'> = {
  active: 'warning',
  monitoring: 'info',
  resolved: 'success',
};

function SendPage() {
  const { data: flags, isLoading } = useSend();
  const { data: children } = useChildren();
  const createSend = useCreateSend();
  const deleteSend = useDeleteSend();

  const [editing, setEditing] = useState<SendFlag | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const childName = (id: number) => children?.find((c) => c.id === id)?.name ?? `Child #${id}`;
  const childRoom = (id: number) => children?.find((c) => c.id === id)?.room ?? '';

  // Distinct categories for the filter dropdown.
  const categories = useMemo(
    () => Array.from(new Set((flags ?? []).map((f) => f.category).filter(Boolean))).sort(),
    [flags],
  );

  const filtered = (flags ?? []).filter((f) => {
    const name = childName(f.child_id).toLowerCase();
    return (
      (!search || name.includes(search.toLowerCase())) &&
      (!category || f.category === category)
    );
  });

  // Stat buckets keyed on status.
  const stats = useMemo(() => {
    let active = 0;
    let monitoring = 0;
    let resolved = 0;
    for (const f of flags ?? []) {
      if (f.status === 'active') active++;
      else if (f.status === 'monitoring') monitoring++;
      else if (f.status === 'resolved') resolved++;
    }
    return { active, monitoring, resolved };
  }, [flags]);

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

      {/* Stat grid — active / monitoring / resolved. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: 'rgba(245,158,11,.12)' }}
            aria-hidden
          >
            🚩
          </span>
          <div>
            <div className="text-2xl font-semibold text-gray-900">{stats.active}</div>
            <div className="text-sm text-muted">Active</div>
          </div>
        </div>
        <div className="stat-card">
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: 'rgba(59,130,246,.12)' }}
            aria-hidden
          >
            👁️
          </span>
          <div>
            <div className="text-2xl font-semibold text-gray-900">{stats.monitoring}</div>
            <div className="text-sm text-muted">Monitoring</div>
          </div>
        </div>
        <div className="stat-card">
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: 'rgba(34,197,94,.12)' }}
            aria-hidden
          >
            ✅
          </span>
          <div>
            <div className="text-2xl font-semibold text-gray-900">{stats.resolved}</div>
            <div className="text-sm text-muted">Resolved</div>
          </div>
        </div>
      </div>

      {/* Filters. */}
      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search by child…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-[14rem]"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All areas of concern</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No SEND records found"
          description={
            (flags ?? []).length === 0
              ? 'All children meeting expected development. Add a record to get started.'
              : 'No records match your filters.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <SendCard
              key={f.id}
              flag={f}
              childName={childName(f.child_id)}
              room={childRoom(f.child_id)}
              onEdit={() => openEdit(f)}
              onDelete={() => {
                if (confirm(`Delete this SEND record for ${childName(f.child_id)}?`))
                  deleteSend.mutate(f.id);
              }}
            />
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

// Flagged-child card: avatar + name/room header, category + status badges,
// details, support-plan box, review date + flagged-by footer. Left accent
// reflects status (Active=amber, Monitoring=info, Resolved=success).
function SendCard({
  flag: f,
  childName,
  room,
  onEdit,
  onDelete,
}: {
  flag: SendFlag;
  childName: string;
  room: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card border-l-4 p-5" style={{ borderLeftColor: STATUS_ACCENT[f.status] }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
            style={{ backgroundImage: avatarGradient(childName) }}
            aria-hidden
          >
            {initials(childName)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-gray-900">{childName}</h2>
            {room && <p className="mt-0.5 text-xs text-muted">{room}</p>}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button className="btn-outline btn-sm" onClick={onEdit} aria-label="Edit SEND record">
            Edit
          </button>
          <button
            className="btn-outline btn-sm text-danger"
            onClick={onDelete}
            aria-label="Delete SEND record"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="info">{f.category}</Badge>
        <Badge variant={STATUS_BADGE[f.status]}>{STATUS_LABEL[f.status]}</Badge>
      </div>

      {f.details && <p className="mt-2 text-sm text-primary">{f.details}</p>}

      {f.support_plan && (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-xs text-primary"
          style={{ background: 'rgba(79,142,247,.07)' }}
        >
          <span className="font-semibold">Support plan: </span>
          {f.support_plan}
        </div>
      )}

      {(f.review_date || f.flagged_by) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted">
          {f.review_date && (
            <span>
              Review: <span className="font-medium text-gray-700">{f.review_date}</span>
            </span>
          )}
          {f.review_date && f.flagged_by && <span aria-hidden>·</span>}
          {f.flagged_by && <span>Flagged by {f.flagged_by}</span>}
        </div>
      )}
    </div>
  );
}

// Add/edit modal. Edit uses a per-record update mutation hook.
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
  const [status, setStatus] = useState<SendStatus>(initial?.status ?? 'active');

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
      status,
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
          {(children ?? []).map((c: Child) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Area of concern">
        <input
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Speech & language, Social skills, Motor development…"
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
        <input className="input" value={flaggedBy} onChange={(e) => setFlaggedBy(e.target.value)} />
      </Field>

      <Field label="Status">
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value as SendStatus)}
        >
          <option value="active">Active</option>
          <option value="monitoring">Monitoring</option>
          <option value="resolved">Resolved</option>
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
