import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ChildCreateInput } from '@sprout/schemas';
import {
  useChildren,
  useCreateChild,
  useUpdateChild,
  useDeleteChild,
  ageFromDob,
  type Child,
} from '../../features/children/useChildren';
import { ChildForm } from '../../features/children/ChildForm';
import { Modal, Badge, Spinner, EmptyState } from '../../components/ui';

export const Route = createFileRoute('/children/')({ component: ChildrenPage });

// ── Avatar helpers (mirrors reference app's `clr` / `ini`) ──────────────
// Stable gradient picked from a hash of the first two character codes.
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

function hasAllergy(allergy: string): boolean {
  const a = (allergy ?? '').trim();
  return a !== '' && a.toLowerCase() !== 'none';
}

function ChildAvatar({ child }: { child: Child }) {
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-bold text-white"
      style={child.photo_url ? undefined : { backgroundImage: avatarGradient(child.name) }}
    >
      {child.photo_url ? (
        <img src={child.photo_url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(child.name)
      )}
    </div>
  );
}

// Red, attention-grabbing allergy banner (mirrors `allergyBannerHtml`).
function AllergyBanner({ allergies }: { allergies: Child[] }) {
  if (allergies.length === 0) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-xl border-2 border-danger/40 bg-danger-light px-4 py-3"
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-danger/15 text-lg"
        aria-hidden
      >
        ⚠️
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-danger">
          Allergy Alert — Check Before Administering Anything
        </div>
        <div className="truncate text-sm font-bold text-danger">
          {allergies.length} {allergies.length === 1 ? 'child has' : 'children have'} recorded
          allergies — review care plans before snacks &amp; medication.
        </div>
      </div>
    </div>
  );
}

function ChildrenPage() {
  const { data: children, isLoading } = useChildren();
  const createChild = useCreateChild();
  const deleteChild = useDeleteChild();

  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Child | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rooms = useMemo(
    () => Array.from(new Set((children ?? []).map((c) => c.room).filter(Boolean))),
    [children],
  );

  const filtered = (children ?? []).filter(
    (c) =>
      (!search || c.name.toLowerCase().includes(search.toLowerCase())) &&
      (!room || c.room === room) &&
      (!status || c.status === status),
  );

  const allergyChildren = useMemo(
    () => filtered.filter((c) => hasAllergy(c.allergy)),
    [filtered],
  );

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: Child) => {
    setEditing(c);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Children</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add child
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[10rem]" value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">All rooms</option>
          {rooms.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[10rem]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {!isLoading && allergyChildren.length > 0 && <AllergyBanner allergies={allergyChildren} />}

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title="No children found" description="Add a child or adjust your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">Age</th>
                <th className="px-4 py-2 font-medium">Allergy</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <ChildAvatar child={c} />
                      <div className="min-w-0">
                        <Link
                          to="/children/$childId"
                          params={{ childId: String(c.id) }}
                          className="block truncate font-semibold text-primary"
                        >
                          {c.name}
                        </Link>
                        <div className="text-xs text-muted">
                          {c.dob ?? '—'}
                          {c.gender ? ` · ${c.gender}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {c.room ? <Badge variant="info">{c.room}</Badge> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-2">{ageFromDob(c.dob)}</td>
                  <td className="px-4 py-2">
                    {hasAllergy(c.allergy) ? (
                      <Badge variant="danger">{c.allergy}</Badge>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={c.status === 'Active' ? 'success' : 'muted'}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(c)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${c.name}?`)) deleteChild.mutate(c.id);
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

      <ChildModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createChild.isPending}
        onCreate={(data) => createChild.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Add/edit modal. Edit uses a per-child update mutation hook.
function ChildModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Child | null;
  onClose: () => void;
  onCreate: (data: ChildCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateChild = useUpdateChild(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add child'}>
      <ChildForm
        initial={editing ?? undefined}
        submitting={editing ? updateChild.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateChild.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}
