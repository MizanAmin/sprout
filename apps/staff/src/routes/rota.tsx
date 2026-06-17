import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useRota,
  useUpsertRota,
  useDeleteRota,
  mondayOf,
  addWeeks,
  type RotaRow,
} from '../features/rota/useRota';
import { useStaff } from '../features/staff/useStaff';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/rota')({
  component: RotaPage,
});

// The grid shows a full Mon–Sun week, backed by the `rota` table (migration 005,
// see apps/api/src/routes/rota.ts) which stores mon..sun text columns — one row
// per (staff_name, week_start).
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Weekday = (typeof DAYS)[number];

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

// UK date formatting to mirror fmtDateUK() in the reference.
const fmtDateUK = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const surname = (name: string) => name.split(' ').slice(-1)[0] || name;

// The reference treats each cell as a coloured "shift" badge. We don't have a
// structured shift type/time/room in the live model — only a free-text value per
// day (e.g. "8-4 · Sunflower"). Heuristically classify it for badge colour so the
// grid reads like the reference (Off / Holiday / Sick / Training vs a worked shift).
// TODO: needs structured shift fields (type, start_time, end_time, room) on the
// rota table to colour-code reliably instead of parsing free text.
function shiftVariant(value: string): 'success' | 'info' | 'danger' | 'warning' | 'muted' {
  const v = value.trim().toLowerCase();
  if (!v || v === 'off') return 'muted';
  if (v.startsWith('hol')) return 'info';
  if (v.startsWith('sick')) return 'danger';
  if (v.startsWith('train')) return 'warning';
  return 'success';
}

interface CellTarget {
  staffName: string;
  day: Weekday;
}

function RotaPage() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const { data: rows, isLoading } = useRota(weekStart);
  const { data: staff, isLoading: staffLoading } = useStaff();
  const deleteRota = useDeleteRota();

  // null = closed; CellTarget = add/edit a specific staff+day cell.
  const [editing, setEditing] = useState<CellTarget | null>(null);

  // Index rota rows by staff_name for O(1) cell lookups.
  const rowByStaff = useMemo(() => {
    const map = new Map<string, RotaRow>();
    for (const r of rows ?? []) map.set(r.staff_name, r);
    return map;
  }, [rows]);

  // Active staff drive the grid rows (mirrors the reference's activeStaff). This
  // surfaces staff who have no rota row yet so a shift can be added for them.
  const activeStaff = useMemo(
    () => (staff ?? []).filter((s) => s.status === 'Active'),
    [staff],
  );

  const loading = isLoading || staffLoading;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Rota</h1>
        <div className="flex items-center gap-2">
          <button
            className="btn-outline btn-sm"
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          >
            ← Prev
          </button>
          <input
            type="date"
            className="input max-w-[10rem]"
            value={weekStart}
            onChange={(e) =>
              e.target.value && setWeekStart(mondayOf(new Date(e.target.value)))
            }
          />
          <button
            className="btn-outline btn-sm"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          >
            Next →
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : activeStaff.length === 0 ? (
        <EmptyState
          title="No active staff yet"
          description="Add team members on the Staff page to start building the weekly rota."
        />
      ) : (
        <div className="card p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">
              Week of {fmtDateUK(weekStart)}
            </span>
            <span className="text-xs text-muted">{activeStaff.length} active staff</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="bg-bg text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-semibold">Staff Member</th>
                  {DAYS.map((d) => (
                    <th key={d} className="px-3 py-2 font-semibold">
                      {DAY_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeStaff.map((s) => {
                  const row = rowByStaff.get(s.name);
                  return (
                    <tr key={s.id} className="align-top">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {initials(s.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-gray-900">
                              {surname(s.name)}
                            </div>
                            <div className="truncate text-[10px] text-muted">{s.role}</div>
                          </div>
                        </div>
                      </td>

                      {DAYS.map((d) => {
                        const value = (row?.[d] ?? '').trim();
                        return (
                          <td key={d} className="px-2 py-2">
                            <button
                              type="button"
                              className="flex min-h-[44px] w-full flex-col items-start gap-1 rounded-lg border border-transparent p-1 text-left hover:border-border hover:bg-bg"
                              onClick={() => setEditing({ staffName: s.name, day: d })}
                            >
                              {value ? (
                                <Badge variant={shiftVariant(value)}>{value}</Badge>
                              ) : (
                                <span className="text-base text-border">+</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <ShiftModal
          target={editing}
          weekStart={weekStart}
          existing={rowByStaff.get(editing.staffName) ?? null}
          onClose={() => setEditing(null)}
          onDelete={(id) => {
            if (confirm(`Clear all shifts for ${editing.staffName} this week?`)) {
              deleteRota.mutate(id, { onSuccess: () => setEditing(null) });
            }
          }}
        />
      )}
    </div>
  );
}

// ── Add / edit shift modal ───────────────────────────────────────────────────
// The reference modal captures Type, Start/End time, Room and Notes for a single
// shift. The live API stores a single free-text value per day, so we compose
// those inputs into one string ("08:00-17:00 · Room") and write it to the relevant
// day column via the upsert endpoint (which merges onto the existing week row).
// TODO: needs structured shift columns on the rota table to persist type/start/
// end/room/notes separately instead of a composed free-text string.

const shiftFormSchema = z.object({
  type: z.enum(['Work', 'Holiday', 'Sick', 'Training', 'Off']),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  room: z.string().optional(),
});
type ShiftFormInput = z.infer<typeof shiftFormSchema>;

// Best-effort parse of an existing free-text day value back into form fields.
function parseDayValue(value: string): ShiftFormInput {
  const v = value.trim();
  if (!v) return { type: 'Work', startTime: '08:00', endTime: '17:00', room: '' };
  const variant = shiftVariant(v);
  if (variant !== 'success') {
    const type =
      variant === 'info'
        ? 'Holiday'
        : variant === 'danger'
          ? 'Sick'
          : variant === 'warning'
            ? 'Training'
            : 'Off';
    return { type, startTime: '', endTime: '', room: '' };
  }
  const [times, room] = v.split('·').map((p) => p.trim());
  const [startTime = '08:00', endTime = '17:00'] = (times ?? '').split('-').map((p) => p.trim());
  return { type: 'Work', startTime, endTime, room: room ?? '' };
}

function composeDayValue(d: ShiftFormInput): string {
  if (d.type !== 'Work') return d.type;
  const times = [d.startTime, d.endTime].filter(Boolean).join('-');
  return [times, d.room?.trim()].filter(Boolean).join(' · ');
}

function ShiftModal({
  target,
  weekStart,
  existing,
  onClose,
  onDelete,
}: {
  target: CellTarget;
  weekStart: string;
  existing: RotaRow | null;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const upsertRota = useUpsertRota();
  const initial = useMemo(
    () => parseDayValue(existing?.[target.day] ?? ''),
    [existing, target.day],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ShiftFormInput>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: initial,
  });

  const type = watch('type');
  const isWork = type === 'Work';

  const onSubmit = (data: ShiftFormInput) => {
    // Merge: preserve the other days on this staff member's week row.
    const dayValues: Partial<Record<Weekday, string>> = {};
    for (const d of DAYS) dayValues[d] = existing?.[d] ?? '';
    dayValues[target.day] = composeDayValue(data);

    upsertRota.mutate(
      { staffName: target.staffName, weekStart, ...dayValues },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${existing?.[target.day] ? 'Edit' : 'Add'} shift — ${target.staffName} · ${DAY_LABELS[target.day]}`}
      footer={
        <div className="flex justify-end gap-2">
          {existing && (
            <button
              type="button"
              className="btn-outline btn-sm text-danger"
              onClick={() => onDelete(existing.id)}
            >
              Delete week
            </button>
          )}
          <button
            type="submit"
            form="shift-form"
            className="btn-primary"
            disabled={upsertRota.isPending}
          >
            {upsertRota.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      <form id="shift-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-xs text-muted">Week beginning {fmtDateUK(weekStart)}</p>

        <Field label="Type" error={errors.type?.message}>
          <select className="input" {...register('type')}>
            {['Work', 'Holiday', 'Sick', 'Training', 'Off'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        {isWork && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time">
                <input type="time" className="input" {...register('startTime')} />
              </Field>
              <Field label="End time">
                <input type="time" className="input" {...register('endTime')} />
              </Field>
            </div>
            <Field label="Room">
              <input className="input" placeholder="e.g. Sunflower, All" {...register('room')} />
            </Field>
          </>
        )}

        {/* TODO: needs a structured shift model to capture per-shift Notes
            (the reference has a Notes field). The current free-text day column
            has no room for it without polluting the displayed value. */}
      </form>
    </Modal>
  );
}
