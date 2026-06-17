import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { RelativeCreateInput } from '@sprout/schemas';
import {
  useRelatives,
  useCreateRelative,
  useUpdateRelative,
  useDeleteRelative,
  type Relative,
} from '../features/relatives/useRelatives';
import { RelativeForm } from '../features/relatives/RelativeForm';
import { useChildren, type Child } from '../features/children/useChildren';
import { Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/relatives')({
  component: RelativesPage,
});

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

function RelativeAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
      style={{ backgroundImage: avatarGradient(name) }}
    >
      {initials(name)}
    </div>
  );
}

function RelativesPage() {
  const { data: relatives, isLoading } = useRelatives();
  const { data: children } = useChildren();
  const createRelative = useCreateRelative();
  const deleteRelative = useDeleteRelative();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Relative | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // child_id → name, for the "Linked child" column.
  const childName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of children ?? []) map.set(c.id, c.name);
    return map;
  }, [children]);

  const filtered = useMemo(
    () =>
      (relatives ?? []).filter(
        (r) => !search || r.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [relatives, search],
  );

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (r: Relative) => {
    setEditing(r);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Relatives</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add relative
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No relatives yet"
          description="Add parents and emergency contacts so families can be linked to children."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Relationship</th>
                <th className="px-4 py-2 font-medium">Linked child</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Access</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <RelativeAvatar name={r.name} />
                      <span className="font-semibold text-gray-900">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {r.relation ? (
                      <Badge variant="info">{r.relation}</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {r.child_id != null ? (
                      childName.get(r.child_id) ?? `Child #${r.child_id}`
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{r.phone || <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-2">{r.email || <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.is_primary_contact && <Badge variant="success">Primary</Badge>}
                      {r.is_emergency_contact && <Badge variant="warning">Emergency</Badge>}
                      {r.has_portal_access && <Badge variant="success">Portal</Badge>}
                      {!r.is_primary_contact && !r.is_emergency_contact && !r.has_portal_access && (
                        <span className="text-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(r)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${r.name}?`)) deleteRelative.mutate(r.id);
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

      <RelativeModal
        open={modalOpen}
        editing={editing}
        children={children ?? []}
        onClose={() => setModalOpen(false)}
        createSubmitting={createRelative.isPending}
        onCreate={(data) => createRelative.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Add/edit modal. Edit uses a per-relative update mutation hook.
function RelativeModal({
  open,
  editing,
  children,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Relative | null;
  children: Child[];
  onClose: () => void;
  onCreate: (data: RelativeCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateRelative = useUpdateRelative(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add relative'}>
      <RelativeForm
        initial={editing ?? undefined}
        children={children}
        submitting={editing ? updateRelative.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateRelative.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}
