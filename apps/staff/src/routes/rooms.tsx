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
import { useStaff, type Staff } from '../features/staff/useStaff';
import { Modal, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/rooms')({
  component: RoomsPage,
});

// ── Avatar helpers (mirrors children list's `avatarGradient` / `initials`) ──
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

// OFSTED required ratios (children per adult): 0-2 = 1:3, 2-3 = 1:5, 3-5 = 1:8.
// Mirrors requiredRatio() in the reference app.
function requiredRatio(ageGroup: string): number {
  if (!ageGroup) return 8;
  if (ageGroup.startsWith('0')) return 3;
  if (ageGroup.startsWith('2')) return 5;
  return 8;
}

function RoomsPage() {
  const { data: rooms, isLoading } = useRooms();
  const { data: children } = useChildren();
  const { data: staff } = useStaff();
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
        <EmptyState
          title="No rooms set up yet"
          description="Create rooms to organise children, set capacities and track staff ratios."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(rooms ?? []).map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              used={occupancy.get(r.name) ?? 0}
              staff={(staff ?? []).filter((s) => s.room === r.name)}
              onEdit={() => openEdit(r)}
              onDelete={() => {
                if (confirm(`Delete ${r.name}?`)) deleteRoom.mutate(r.id);
              }}
            />
          ))}
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

// Small ~24px avatar with up-to-2 initials over a hashed gradient.
function StaffAvatar({ member }: { member: Staff }) {
  return (
    <div
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-surface"
      style={{ backgroundImage: avatarGradient(member.name) }}
      title={member.role ? `${member.name} · ${member.role}` : member.name}
    >
      {initials(member.name)}
    </div>
  );
}

function RoomCard({
  room: r,
  used,
  staff,
  onEdit,
  onDelete,
}: {
  room: Room;
  used: number;
  staff: Staff[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = r.color || '#4f8ef7';
  const cap = r.capacity || 0;
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const free = Math.max(0, cap - used);
  const reqRatio = requiredRatio(r.age_group);
  const staffNeeded = Math.ceil(used / reqRatio);

  return (
    <div className="card border-t-4 p-5" style={{ borderTopColor: color }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div>
            <h2 className="text-sm font-bold text-gray-900">{r.name}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {[r.age_group, r.staff_lead].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button className="btn-outline btn-sm" onClick={onEdit} aria-label="Edit room">
            Edit
          </button>
          <button
            className="btn-outline btn-sm text-danger"
            onClick={onDelete}
            aria-label="Delete room"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-900">Occupancy</span>
          <span className="text-muted">
            {used} / {cap}
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="info">{cap} max</Badge>
        <Badge variant="success">{used} enrolled</Badge>
        <Badge variant="warning">{free} free</Badge>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted">
            Staff{staff.length > 0 ? ` (${staff.length})` : ''}
          </span>
        </div>
        {staff.length > 0 ? (
          <div className="mt-2 flex items-center -space-x-1.5">
            {staff.map((s) => (
              <StaffAvatar key={s.id} member={s} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted">No staff assigned</p>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted">
            Staff ratio
          </span>
          <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-bold text-muted">
            Ofsted 1:{reqRatio}
          </span>
        </div>
        {used > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            {/* Staff-count unknown without a staff endpoint; show requirement only. */}
            {staffNeeded} staff required for {used} children
          </p>
        )}
      </div>
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
