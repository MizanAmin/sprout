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
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/staff')({
  component: StaffPage,
});

// ── Avatar helpers (mirrors reference app's `clr` / `ini`, and children/index.tsx) ──
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

function StaffPage() {
  const { data: staff, isLoading } = useStaff();
  const createStaff = useCreateStaff();
  const deleteStaff = useDeleteStaff();
  const isManager = useCurrentUser()?.role === 'manager';

  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Staff | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rooms = useMemo(
    () => Array.from(new Set((staff ?? []).map((s) => s.room).filter(Boolean))),
    [staff],
  );

  const filtered = (staff ?? []).filter(
    (s) =>
      (!search || s.name.toLowerCase().includes(search.toLowerCase())) &&
      (!room || s.room === room) &&
      (!status || s.status === status),
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
        {isManager && (
          <button className="btn-primary" onClick={openAdd}>
            Add staff
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-[10rem]"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        >
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
        <EmptyState
          title="No staff found"
          description="Add your team to assign rooms, track qualifications and manage rotas."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <StaffCard
              key={s.id}
              staff={s}
              isManager={isManager}
              onEdit={() => openEdit(s)}
              onDelete={() => {
                if (confirm(`Delete ${s.name}?`)) deleteStaff.mutate(s.id);
              }}
            />
          ))}
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

// Staff card — colored avatar initials, name, role, room badge, qualification,
// phone, status badge, and manager edit/delete actions (mirrors reference `pgStaff`).
function StaffCard({
  staff,
  isManager,
  onEdit,
  onDelete,
}: {
  staff: Staff;
  isManager: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-surface p-4 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-extrabold text-white"
        style={{ backgroundImage: avatarGradient(staff.name) }}
        aria-hidden
      >
        {initials(staff.name)}
      </div>

      <h3 className="mt-3 text-sm font-bold text-gray-900">{staff.name}</h3>
      {staff.role && <p className="text-xs text-muted">{staff.role}</p>}

      {staff.room && (
        <div className="mt-2">
          <Badge variant="info">{staff.room}</Badge>
        </div>
      )}

      {staff.qualification && (
        <p className="mt-2 text-[11px] text-muted">{staff.qualification}</p>
      )}
      {staff.phone && <p className="mt-1 text-[11px] text-muted">📞 {staff.phone}</p>}

      <div className="mt-2">
        <Badge variant={staff.status === 'Active' ? 'success' : 'muted'}>{staff.status}</Badge>
      </div>

      {isManager && (
        <div className="mt-3 flex gap-2">
          <button className="btn-outline btn-sm" onClick={onEdit}>
            Edit
          </button>
          <button className="btn-outline btn-sm text-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
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
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add staff member'}>
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
