import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useWaitingList,
  useCreateWaitingListEntry,
  useUpdateWaitingListEntry,
  useDeleteWaitingListEntry,
  type WaitingListEntry,
  type WaitingListCreateInput,
  type WaitingStatus,
} from '../features/waiting-list/useWaitingList';
import { WaitingListForm } from '../features/waiting-list/WaitingListForm';
import { Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/waiting-list')({
  component: WaitingListPage,
});

const STATUS_VARIANT: Record<WaitingStatus, 'info' | 'warning' | 'success' | 'muted'> = {
  waiting: 'info',
  offered: 'warning',
  enrolled: 'success',
  withdrawn: 'muted',
};

function WaitingListPage() {
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<WaitingListEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: entries, isLoading } = useWaitingList(status ? { status } : {});
  const createEntry = useCreateWaitingListEntry();
  const deleteEntry = useDeleteWaitingListEntry();

  // Ordered by position (ascending).
  const ordered = [...(entries ?? [])].sort((a, b) => a.position - b.position);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (e: WaitingListEntry) => {
    setEditing(e);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Waiting List</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add entry
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="input max-w-[12rem]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="waiting">Waiting</option>
          <option value="offered">Offered</option>
          <option value="enrolled">Enrolled</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : ordered.length === 0 ? (
        <EmptyState title="No waiting list entries" description="Add one or adjust your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Position</th>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Parent</th>
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">Desired start</th>
                <th className="px-4 py-2 font-medium">Days required</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordered.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{e.position}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{e.child_name}</td>
                  <td className="px-4 py-2">{e.parent_name || '—'}</td>
                  <td className="px-4 py-2">{e.room || '—'}</td>
                  <td className="px-4 py-2">{e.desired_start ?? '—'}</td>
                  <td className="px-4 py-2">{e.days_required || '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[e.status]}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(e)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${e.child_name} from the waiting list?`))
                          deleteEntry.mutate(e.id);
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

      <WaitingListModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createEntry.isPending}
        onCreate={(data) => createEntry.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Add/edit modal. Edit uses a per-entry update mutation hook.
function WaitingListModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: WaitingListEntry | null;
  onClose: () => void;
  onCreate: (data: WaitingListCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateEntry = useUpdateWaitingListEntry(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.child_name}` : 'Add waiting list entry'}
    >
      <WaitingListForm
        initial={editing ?? undefined}
        submitting={editing ? updateEntry.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateEntry.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}
