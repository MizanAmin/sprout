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
        <select className="input max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title="No children found" description="Add a child or adjust your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">DOB</th>
                <th className="px-4 py-2 font-medium">Age</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link
                      to="/children/$childId"
                      params={{ childId: String(c.id) }}
                      className="font-medium text-primary"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{c.room || '—'}</td>
                  <td className="px-4 py-2">{c.dob ?? '—'}</td>
                  <td className="px-4 py-2">{ageFromDob(c.dob)}</td>
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
          editing
            ? updateChild.mutate(data, { onSuccess: onClose })
            : onCreate(data)
        }
      />
    </Modal>
  );
}
