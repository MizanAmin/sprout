import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useRota,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  mondayOf,
  addWeeks,
  weekDates,
  type RotaShift,
  type ShiftInput,
} from '../features/rota/useRota';
import { useStaff, type Staff } from '../features/staff/useStaff';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/rota')({
  component: RotaPage,
});

type ShiftType = RotaShift['type'];

const SHIFT_TYPES: ShiftType[] = ['work', 'holiday', 'sick', 'training', 'off'];

const TYPE_LABELS: Record<ShiftType, string> = {
  work: 'Work',
  holiday: 'Holiday',
  sick: 'Sick',
  training: 'Training',
  off: 'Off',
};

const TYPE_VARIANTS: Record<ShiftType, 'success' | 'info' | 'danger' | 'warning' | 'muted'> = {
  work: 'success',
  holiday: 'info',
  sick: 'danger',
  training: 'warning',
  off: 'muted',
};

// UK long date, e.g. "9 Jun 2025".
const fmtDateUK = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Column header parts for a week date — weekday short name + day-of-month.
const fmtWeekday = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short' });
const fmtDayOfMonth = (iso: string) => new Date(iso).getDate();

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

// Human-readable chip label for a shift, given its type.
function chipLabel(shift: RotaShift): string {
  if (shift.type === 'work') {
    const times = [shift.start_time, shift.end_time].filter(Boolean).join('–');
    return [times, shift.room].filter(Boolean).join(' · ') || 'Work';
  }
  return TYPE_LABELS[shift.type];
}

// Target for the modal: either a brand-new shift for a staff+date cell, or an
// existing shift being edited.
type ModalTarget =
  | { mode: 'create'; staffId: number; staffName: string; date: string }
  | { mode: 'edit'; shift: RotaShift };

function RotaPage() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const { data: shifts, isLoading: rotaLoading } = useRota(weekStart);
  const { data: staff, isLoading: staffLoading } = useStaff();
  const deleteShift = useDeleteShift();

  // null = closed.
  const [target, setTarget] = useState<ModalTarget | null>(null);

  const dates = useMemo(() => weekDates(weekStart), [weekStart]);

  // Active staff drive the grid rows, so staff with no shifts still appear.
  const activeStaff = useMemo(
    () => (staff ?? []).filter((s) => s.status === 'Active'),
    [staff],
  );

  // Index shifts by `${staff_id}|${date}` for O(1) cell lookups.
  const shiftsByCell = useMemo(() => {
    const map = new Map<string, RotaShift[]>();
    for (const sh of shifts ?? []) {
      const key = `${sh.staff_id}|${sh.date}`;
      const list = map.get(key);
      if (list) list.push(sh);
      else map.set(key, [sh]);
    }
    return map;
  }, [shifts]);

  const loading = rotaLoading || staffLoading;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Rota</h1>
        <div className="flex items-center gap-2">
          <button
            className="btn-outline btn-sm"
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          >
            ◀ Prev
          </button>
          <span className="min-w-[12rem] text-center text-sm font-semibold text-gray-900">
            Week of {fmtDateUK(weekStart)}
          </span>
          <button
            className="btn-outline btn-sm"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          >
            Next ▶
          </button>
          <button
            className="btn-outline btn-sm"
            onClick={() => setWeekStart(mondayOf(new Date()))}
          >
            Today
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bg-bg text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-semibold">Staff Member</th>
                  {dates.map((d) => (
                    <th key={d} className="px-3 py-2 font-semibold">
                      <div>{fmtWeekday(d)}</div>
                      <div className="text-xs text-gray-700">{fmtDayOfMonth(d)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeStaff.map((s) => (
                  <StaffRow
                    key={s.id}
                    staff={s}
                    dates={dates}
                    shiftsByCell={shiftsByCell}
                    onAdd={(date) =>
                      setTarget({ mode: 'create', staffId: s.id, staffName: s.name, date })
                    }
                    onEdit={(shift) => setTarget({ mode: 'edit', shift })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {target && (
        <ShiftModal
          target={target}
          onClose={() => setTarget(null)}
          onDelete={(id) => deleteShift.mutate(id, { onSuccess: () => setTarget(null) })}
        />
      )}
    </div>
  );
}

function StaffRow({
  staff,
  dates,
  shiftsByCell,
  onAdd,
  onEdit,
}: {
  staff: Staff;
  dates: string[];
  shiftsByCell: Map<string, RotaShift[]>;
  onAdd: (date: string) => void;
  onEdit: (shift: RotaShift) => void;
}) {
  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {initials(staff.name)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-gray-900">{staff.name}</div>
            <div className="truncate text-[10px] text-muted">{staff.role}</div>
          </div>
        </div>
      </td>

      {dates.map((date) => {
        const cellShifts = shiftsByCell.get(`${staff.id}|${date}`) ?? [];
        return (
          <td key={date} className="px-2 py-2">
            <div className="flex min-h-[44px] flex-col items-start gap-1">
              {cellShifts.map((shift) => (
                <button
                  key={shift.id}
                  type="button"
                  className="text-left"
                  title={shift.notes || undefined}
                  onClick={() => onEdit(shift)}
                >
                  <Badge variant={TYPE_VARIANTS[shift.type]}>{chipLabel(shift)}</Badge>
                </button>
              ))}
              <button
                type="button"
                className="rounded-lg border border-transparent px-1 text-base leading-none text-border hover:border-border hover:bg-bg hover:text-muted"
                aria-label={`Add shift for ${staff.name}`}
                onClick={() => onAdd(date)}
              >
                +
              </button>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

// ── Add / edit shift modal ───────────────────────────────────────────────────

const shiftFormSchema = z.object({
  type: z.enum(['work', 'holiday', 'sick', 'training', 'off']),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  room: z.string().optional(),
  notes: z.string().optional(),
});
type ShiftFormValues = z.infer<typeof shiftFormSchema>;

function ShiftModal({
  target,
  onClose,
  onDelete,
}: {
  target: ModalTarget;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const isEdit = target.mode === 'edit';
  const shift = isEdit ? target.shift : null;

  const staffId = isEdit ? target.shift.staff_id : target.staffId;
  const staffName = isEdit ? target.shift.staff_name : target.staffName;
  const date = isEdit ? target.shift.date : target.date;

  const createShift = useCreateShift();
  const updateShift = useUpdateShift(shift?.id ?? 0);

  const defaults: ShiftFormValues = shift
    ? {
        type: shift.type,
        startTime: shift.start_time ?? '08:00',
        endTime: shift.end_time ?? '17:00',
        room: shift.room ?? '',
        notes: shift.notes ?? '',
      }
    : { type: 'work', startTime: '08:00', endTime: '17:00', room: '', notes: '' };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: defaults,
  });

  const type = watch('type');
  const isWork = type === 'work';

  const pending = createShift.isPending || updateShift.isPending;

  const onSubmit = (values: ShiftFormValues) => {
    const payload: ShiftInput = {
      staffId,
      staffName,
      date,
      type: values.type,
      startTime: isWork ? values.startTime : undefined,
      endTime: isWork ? values.endTime : undefined,
      room: isWork ? values.room?.trim() || undefined : undefined,
      notes: values.notes?.trim() || undefined,
    };

    if (isEdit) {
      updateShift.mutate(payload, { onSuccess: onClose });
    } else {
      createShift.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'Add'} shift — ${staffName}`}
      footer={
        <div className="flex justify-end gap-2">
          {isEdit && shift && (
            <button
              type="button"
              className="btn-outline btn-sm mr-auto text-danger"
              onClick={() => onDelete(shift.id)}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn-outline btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="shift-form" className="btn-primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      <form id="shift-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-xs text-muted">{fmtDateUK(date)}</p>

        <Field label="Type" error={errors.type?.message}>
          <select className="input" {...register('type')}>
            {SHIFT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
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
              <input className="input" placeholder="e.g. Babies, Toddlers" {...register('room')} />
            </Field>
          </>
        )}

        <Field label="Notes">
          <input className="input" placeholder="Optional note" {...register('notes')} />
        </Field>
      </form>
    </Modal>
  );
}
