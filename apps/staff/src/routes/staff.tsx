import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { StaffCreateInput } from '@sprout/schemas';
import {
  useStaff,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  type Staff,
} from '../features/staff/useStaff';
import { StaffForm } from '../features/staff/StaffForm';
import { Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/staff')({
  component: StaffPage,
});

function StaffPage() {
  const { data: staff, isLoading } = useStaff();
  const createStaff = useCreateStaff();
  const deleteStaff = useDeleteStaff();

  const [room, setRoom] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Staff | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rooms = useMemo(
    () => Array.from(new Set((staff ?? []).map((s) => s.room).filter(Boolean))),
    [staff],
  );

  const filtered = (staff ?? []).filter(
    (s) => (!room || s.room === room) && (!status || s.status === status),
  );

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (s: Staff) => {
    setEditing(s);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Staff</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add staff
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
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

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title="No staff found" description="Add a staff member or adjust your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">Qualification</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-2">{s.role || '—'}</td>
                  <td className="px-4 py-2">{s.room || '—'}</td>
                  <td className="px-4 py-2">{s.qualification || '—'}</td>
                  <td className="px-4 py-2">{s.phone || '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant={s.status === 'Active' ? 'success' : 'muted'}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(s)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${s.name}?`)) deleteStaff.mutate(s.id);
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

      <StaffModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createStaff.isPending}
        onCreate={(data) => createStaff.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Add/edit modal. Edit uses a per-staff update mutation hook.
function StaffModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Staff | null;
  onClose: () => void;
  onCreate: (data: StaffCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateStaff = useUpdateStaff(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add staff'}>
      <StaffForm
        initial={editing ?? undefined}
        submitting={editing ? updateStaff.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateStaff.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}
