import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useWaitingList,
  useCreateWaitingListEntry,
  useUpdateWaitingListEntry,
  useDeleteWaitingListEntry,
  useMoveWaitingList,
  type WaitingListEntry,
  type WaitingListCreateInput,
  type WaitingStatus,
} from '../features/waiting-list/useWaitingList';
import { WaitingListForm } from '../features/waiting-list/WaitingListForm';
import { ageFromDob } from '../features/children/useChildren';
import { Modal, Badge, Spinner, EmptyState, StatCard } from '../components/ui';

export const Route = createFileRoute('/waiting-list')({
  component: WaitingListPage,
});

const STATUS_VARIANT: Record<WaitingStatus, 'info' | 'warning' | 'success' | 'muted'> = {
  waiting: 'info',
  offered: 'warning',
  enrolled: 'success',
  withdrawn: 'muted',
};

const STATUS_LABEL: Record<WaitingStatus, string> = {
  waiting: 'Waiting',
  offered: 'Offered',
  enrolled: 'Enrolled',
  withdrawn: 'Withdrawn',
};

// Format an ISO date (YYYY-MM-DD) as UK short date — mirrors fmtDateUK in the reference.
function fmtDateUK(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function WaitingListPage() {
  const [status, setStatus] = useState('');
  const [room, setRoom] = useState('');
  const [editing, setEditing] = useState<WaitingListEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Status filtering is server-side; room filtering is client-side over the result.
  const { data: entries, isLoading } = useWaitingList(status ? { status } : {});
  const createEntry = useCreateWaitingListEntry();
  const deleteEntry = useDeleteWaitingListEntry();
  const moveEntry = useMoveWaitingList();

  const allEntries = entries ?? [];

  // KPI counts always reflect the full (status-filtered) result set, before the
  // client-side room filter is applied — mirrors the reference stat cards.
  const stats = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return {
      waiting: allEntries.filter((e) => e.status === 'waiting').length,
      offered: allEntries.filter((e) => e.status === 'offered').length,
      enrolled: allEntries.filter((e) => e.status === 'enrolled').length,
      thisMonth: allEntries.filter(
        (e) =>
          (e.desired_start ?? '').startsWith(ym) &&
          e.status !== 'enrolled' &&
          e.status !== 'withdrawn',
      ).length,
    };
  }, [allEntries]);

  // Rooms present in the data → room filter options.
  const rooms = useMemo(
    () => Array.from(new Set(allEntries.map((e) => e.room).filter(Boolean))),
    [allEntries],
  );

  // Ordered by queue position (ascending), then room-filtered.
  const ordered = useMemo(
    () =>
      [...allEntries]
        .filter((e) => !room || e.room === room)
        .sort((a, b) => a.position - b.position),
    [allEntries, room],
  );

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
          Add to waiting list
        </button>
      </div>

      {/* KPI cards — mirrors the reference stats-grid. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Waiting" value={stats.waiting} />
        <StatCard label="Place offered" value={stats.offered} />
        <StatCard label="Starting this month" value={stats.thisMonth} />
        <StatCard label="Enrolled from list" value={stats.enrolled} />
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
        <select className="input max-w-[12rem]" value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">All rooms</option>
          {rooms.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : ordered.length === 0 ? (
        <EmptyState
          title="Waiting list is empty"
          description="Add prospective children to track interest and offer places as spaces open up."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">Queue</span>
            <span className="text-xs text-muted">
              {ordered.length} {ordered.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="w-14 px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Parent / contact</th>
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">Sessions</th>
                <th className="px-4 py-2 font-medium">Desired start</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordered.map((e, idx) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-primary">{e.position}</span>
                      <div className="flex flex-col leading-none">
                        <button
                          className="text-xs text-muted hover:text-primary disabled:opacity-30"
                          aria-label="Move up"
                          disabled={idx === 0 || moveEntry.isPending}
                          onClick={() => moveEntry.mutate({ id: e.id, direction: 'up' })}
                        >
                          ▲
                        </button>
                        <button
                          className="text-xs text-muted hover:text-primary disabled:opacity-30"
                          aria-label="Move down"
                          disabled={idx === ordered.length - 1 || moveEntry.isPending}
                          onClick={() => moveEntry.mutate({ id: e.id, direction: 'down' })}
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-gray-900">{e.child_name}</div>
                    <div className="text-xs text-muted">
                      {e.dob ? `${fmtDateUK(e.dob)} · ${ageFromDob(e.dob)}` : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-gray-900">{e.parent_name || '—'}</div>
                    {e.phone && <div className="text-xs text-muted">{e.phone}</div>}
                    {e.email && <div className="text-xs text-muted">{e.email}</div>}
                  </td>
                  <td className="px-4 py-2">
                    {e.room ? <Badge variant="info">{e.room}</Badge> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-2 text-muted">{e.days_required || '—'}</td>
                  <td className="px-4 py-2 text-muted">{fmtDateUK(e.desired_start)}</td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                  </td>
                  {/* TODO: the reference also has quick status-action buttons (Offer /
                      Enrol / Defer / Withdraw) backed by PUT /waiting-list/:id and a
                      'Deferred' status. This API only supports waiting/offered/enrolled/
                      withdrawn via the edit modal, so status changes go through Edit. */}
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
      title={editing ? `Edit ${editing.child_name}` : 'Add to waiting list'}
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
