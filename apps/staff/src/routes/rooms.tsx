import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { RoomCreateInput } from '@sprout/schemas';
import {
  useRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  type Room,
} from '../features/rooms/useRooms';
import { RoomForm } from '../features/rooms/RoomForm';
import { useChildren } from '../features/children/useChildren';
import { Modal, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/rooms')({
  component: RoomsPage,
});

function RoomsPage() {
  const { data: rooms, isLoading } = useRooms();
  const { data: children } = useChildren();
  const createRoom = useCreateRoom();
  const deleteRoom = useDeleteRoom();

  const [editing, setEditing] = useState<Room | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Active children per room name → occupancy numerator.
  const occupancy = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of children ?? []) {
      if (c.status !== 'Active' || !c.room) continue;
      map.set(c.room, (map.get(c.room) ?? 0) + 1);
    }
    return map;
  }, [children]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (r: Room) => {
    setEditing(r);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Rooms</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add room
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (rooms ?? []).length === 0 ? (
        <EmptyState title="No rooms found" description="Add a room to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(rooms ?? []).map((r) => {
            const used = occupancy.get(r.name) ?? 0;
            const cap = r.capacity || 0;
            const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: r.color || '#4f8ef7' }}
                    />
                    <h2 className="font-semibold text-gray-900">{r.name}</h2>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-sm text-primary" onClick={() => openEdit(r)}>
                      Edit
                    </button>
                    <button
                      className="text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${r.name}?`)) deleteRoom.mutate(r.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {r.age_group && <p className="mt-1 text-sm text-muted">{r.age_group}</p>}
                {r.staff_lead && <p className="mt-1 text-sm text-muted">Lead: {r.staff_lead}</p>}

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>Occupancy</span>
                    <span>
                      {used} / {cap}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: r.color || '#4f8ef7' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RoomModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createRoom.isPending}
        onCreate={(data) => createRoom.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Add/edit modal. Edit uses a per-room update mutation hook.
function RoomModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Room | null;
  onClose: () => void;
  onCreate: (data: RoomCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateRoom = useUpdateRoom(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add room'}>
      <RoomForm
        initial={editing ?? undefined}
        submitting={editing ? updateRoom.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateRoom.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}
