import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  usePlanning,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  type Plan,
  type PlanInput,
} from '../features/planning/usePlanning';
import { useRooms } from '../features/rooms/useRooms';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/planning')({
  component: PlanningPage,
});

// Weekly planner columns — matches the reference app's `days` (Mon–Fri).
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// EYFS / activity areas — mirrors the reference Category dropdown.
const CATEGORIES = ['Literacy', 'Creative', 'Physical', 'Maths', 'Science', 'PSED', 'Other'];

// Per-category colours, copied from the reference `catColor()` helper, so the
// weekly-planner chips read at a glance the same way they do in the source app.
const CAT_COLORS: Record<string, string> = {
  Literacy: '#4f8ef7',
  Creative: '#7367f0',
  Physical: '#28c76f',
  Maths: '#ff9f43',
  Science: '#00cfe8',
  PSED: '#ea5455',
};
const catColor = (c: string | null) => (c && CAT_COLORS[c]) || '#4f8ef7';

function PlanningPage() {
  const { data: plans, isLoading } = usePlanning();
  const deletePlan = useDeletePlan();

  const [editing, setEditing] = useState<Plan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [presetDay, setPresetDay] = useState<string | undefined>(undefined);

  // Group activities by day for the weekly-planner grid.
  const byDay = useMemo(() => {
    const map = new Map<string, Plan[]>();
    for (const d of DAYS) map.set(d, []);
    for (const p of plans ?? []) {
      if (!map.has(p.day)) map.set(p.day, []);
      map.get(p.day)!.push(p);
    }
    return map;
  }, [plans]);

  const openAdd = (day?: string) => {
    setEditing(null);
    setPresetDay(day);
    setModalOpen(true);
  };
  const openEdit = (p: Plan) => {
    setEditing(p);
    setPresetDay(undefined);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Planning</h1>
        <button className="btn-primary" onClick={() => openAdd()}>
          Add activity
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {/* ── Weekly Planner ─────────────────────────────────── */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Weekly Planner</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {DAYS.map((day) => (
                <div key={day} className="rounded-lg border border-border bg-bg p-3">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                    {day}
                  </h3>
                  <div className="space-y-1.5">
                    {(byDay.get(day) ?? []).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => openEdit(p)}
                        className="block w-full truncate rounded-md px-2 py-1 text-left text-[11px] font-medium text-white"
                        style={{ backgroundColor: catColor(p.category) }}
                        title={`${p.time ?? ''} ${p.title}`}
                      >
                        {p.time ? `${p.time} ` : ''}
                        {p.title}
                      </button>
                    ))}
                    <button
                      onClick={() => openAdd(day)}
                      className="text-[11px] text-muted hover:text-primary"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── All Activities ─────────────────────────────────── */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">All Activities</h2>
            {(plans ?? []).length === 0 ? (
              <EmptyState
                title="No activities planned yet"
                description="Add an activity to start building this week's plan."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted">
                      <th className="px-2 py-2">Activity</th>
                      <th className="px-2 py-2">Day</th>
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Category</th>
                      <th className="px-2 py-2">Room</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(plans ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-border">
                        <td className="px-2 py-2">
                          <div className="font-semibold text-gray-900">{p.title}</div>
                          {p.description && (
                            <div className="mt-0.5 text-xs text-muted">{p.description}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-muted">{p.day}</td>
                        <td className="px-2 py-2 text-muted">{p.time || '—'}</td>
                        <td className="px-2 py-2">
                          {p.category && <Badge variant="info">{p.category}</Badge>}
                        </td>
                        <td className="px-2 py-2 text-muted">{p.room || 'All'}</td>
                        <td className="px-2 py-2">
                          <div className="flex justify-end gap-1.5">
                            <button
                              className="btn-outline btn-sm"
                              onClick={() => openEdit(p)}
                              aria-label="Edit activity"
                            >
                              Edit
                            </button>
                            <button
                              className="btn-outline btn-sm text-danger"
                              onClick={() => {
                                if (confirm(`Delete ${p.title}?`)) deletePlan.mutate(p.id);
                              }}
                              aria-label="Delete activity"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <PlanModal
        open={modalOpen}
        editing={editing}
        presetDay={presetDay}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

// Add/edit modal. Edit uses a per-plan update mutation hook.
function PlanModal({
  open,
  editing,
  presetDay,
  onClose,
}: {
  open: boolean;
  editing: Plan | null;
  presetDay?: string;
  onClose: () => void;
}) {
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.title}` : 'Add Activity'}
    >
      <PlanForm
        // Remount on target change so the form picks up fresh initial values.
        key={editing?.id ?? presetDay ?? 'new'}
        initial={editing ?? undefined}
        presetDay={presetDay}
        submitting={editing ? updatePlan.isPending : createPlan.isPending}
        onSubmit={(data) =>
          editing
            ? updatePlan.mutate(data, { onSuccess: onClose })
            : createPlan.mutate(data, { onSuccess: onClose })
        }
      />
    </Modal>
  );
}

function PlanForm({
  initial,
  presetDay,
  submitting,
  onSubmit,
}: {
  initial?: Plan;
  presetDay?: string;
  submitting: boolean;
  onSubmit: (data: PlanInput) => void;
}) {
  const { data: rooms } = useRooms();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [day, setDay] = useState(initial?.day ?? presetDay ?? 'Mon');
  const [time, setTime] = useState(initial?.time ?? '09:00');
  const [category, setCategory] = useState(initial?.category ?? 'Literacy');
  const [room, setRoom] = useState(initial?.room ?? 'All');
  const [description, setDescription] = useState(initial?.description ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      day,
      time: time || undefined,
      category,
      room,
      description: description || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Title">
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Day">
          <select className="input" value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Time">
          <input
            type="time"
            className="input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>

        <Field label="Category">
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Room">
          <select className="input" value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="All">All</option>
            {(rooms ?? []).map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
