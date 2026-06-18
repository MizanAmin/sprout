import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { SessionCreateInput, Day, SessionType } from '@sprout/schemas';
import {
  useSessions,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  type ChildSession,
} from '../features/sessions/useSessions';
import { useChildren, type Child } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge, StatCard } from '../components/ui';
import { fmtDate } from '../lib/date';

export const Route = createFileRoute('/sessions')({
  component: SessionsPage,
});

const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SESSION_TYPES: SessionType[] = ['AM', 'PM', 'Full Day', 'Custom'];

// Session-type colour coding, mirroring sessTypeColors in the reference app
// (Full Day = primary, AM = success, PM = warning, Custom = info).
const TYPE_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'muted'> = {
  AM: 'success',
  PM: 'warning',
  'Full Day': 'info',
  Custom: 'muted',
};

// ── Week helpers ──────────────────────────────────────────────────────────
// ISO date (yyyy-mm-dd) for the Monday of the week containing `d`.
function mondayOf(d: Date): string {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().split('T')[0];
}

function shiftWeek(weekStart: string, deltaDays: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split('T')[0];
}

// Friday (week end) of the given week-start.
function fridayOf(weekStart: string): string {
  return shiftWeek(weekStart, 4);
}

// A weekly session pattern is "active" in a given week if its [start_date, end_date]
// range overlaps the week. end_date null = ongoing.
function activeInWeek(s: ChildSession, weekStart: string): boolean {
  const weekEnd = fridayOf(weekStart);
  if (s.start_date && s.start_date > weekEnd) return false;
  if (s.end_date && s.end_date < weekStart) return false;
  return true;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function SessionsPage() {
  const { data: sessions, isLoading } = useSessions();
  const { data: children } = useChildren();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [editing, setEditing] = useState<ChildSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Pre-fill (childId, day) when quick-adding from a grid cell.
  const [prefill, setPrefill] = useState<{ childId: number; day: Day } | null>(null);

  const activeChildren = useMemo(
    () => (children ?? []).filter((c) => c.status === 'Active'),
    [children],
  );

  // Sessions visible in the selected week, indexed by `${childId}|${day}`.
  const weekSessions = useMemo(
    () => (sessions ?? []).filter((s) => activeInWeek(s, weekStart)),
    [sessions, weekStart],
  );

  const cellIndex = useMemo(() => {
    const map = new Map<string, ChildSession[]>();
    for (const s of weekSessions) {
      const key = `${s.child_id}|${s.day}`;
      const arr = map.get(key);
      if (arr) arr.push(s);
      else map.set(key, [s]);
    }
    return map;
  }, [weekSessions]);

  // Funding summary for the week (mirrors the reference stat cards).
  const totals = useMemo(() => {
    let funded = 0;
    let fee = 0;
    const childIds = new Set<number>();
    for (const s of weekSessions) {
      funded += Number(s.funded_hours) || 0;
      fee += Number(s.fee_hours) || 0;
      childIds.add(s.child_id);
    }
    return { funded, fee, childrenBooked: childIds.size };
  }, [weekSessions]);

  const openAdd = (pre?: { childId: number; day: Day }) => {
    setEditing(null);
    setPrefill(pre ?? null);
    setModalOpen(true);
  };
  const openEdit = (s: ChildSession) => {
    setEditing(s);
    setPrefill(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Sessions &amp; Funding</h1>
        <button className="btn-primary" onClick={() => openAdd()}>
          Add session
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {/* Funding summary tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Funded hours (week)" value={`${totals.funded}h`} />
            <StatCard label="Fee hours (week)" value={`${totals.fee}h`} />
            <StatCard label="Children booked" value={totals.childrenBooked} />
          </div>

          {/* Weekly session grid */}
          <div className="card p-4">
            <div className="mb-4 flex items-center justify-between">
              <button
                className="btn-outline btn-sm"
                onClick={() => setWeekStart((w) => shiftWeek(w, -7))}
              >
                ← Prev
              </button>
              <span className="text-sm font-semibold text-gray-900">
                Week of {fmtDate(weekStart)}
              </span>
              <button
                className="btn-outline btn-sm"
                onClick={() => setWeekStart((w) => shiftWeek(w, 7))}
              >
                Next →
              </button>
            </div>

            {activeChildren.length === 0 ? (
              <EmptyState
                title="No active children"
                description="Add children to start booking weekly sessions."
              />
            ) : (
              <SessionGrid
                children={activeChildren}
                cellIndex={cellIndex}
                onCellAdd={(childId, day) => openAdd({ childId, day })}
                onChipClick={openEdit}
              />
            )}
          </div>
        </>
      )}

      <SessionModal
        open={modalOpen}
        editing={editing}
        prefill={prefill}
        defaultStartDate={weekStart}
        onClose={() => setModalOpen(false)}
        createSubmitting={createSession.isPending}
        onCreate={(data) => createSession.mutate(data, { onSuccess: () => setModalOpen(false) })}
        onDelete={
          editing
            ? () => {
                if (confirm('Delete this session?'))
                  deleteSession.mutate(editing.id, { onSuccess: () => setModalOpen(false) });
              }
            : undefined
        }
      />
    </div>
  );
}

// ── Weekly grid: children (rows) × Mon–Fri (columns) ──────────────────────
function SessionGrid({
  children: kids,
  cellIndex,
  onCellAdd,
  onChipClick,
}: {
  children: Child[];
  cellIndex: Map<string, ChildSession[]>;
  onCellAdd: (childId: number, day: Day) => void;
  onChipClick: (s: ChildSession) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-[160px_repeat(5,1fr)] gap-px rounded-lg bg-border">
        <div className="bg-bg px-3 py-2 text-xs font-semibold text-muted">Child</div>
        {DAYS.map((d) => (
          <div key={d} className="bg-bg px-3 py-2 text-center text-xs font-semibold text-muted">
            {d}
          </div>
        ))}

        {kids.map((c) => (
          <ChildRow
            key={c.id}
            child={c}
            cellIndex={cellIndex}
            onCellAdd={onCellAdd}
            onChipClick={onChipClick}
          />
        ))}
      </div>
    </div>
  );
}

function ChildRow({
  child: c,
  cellIndex,
  onCellAdd,
  onChipClick,
}: {
  child: Child;
  cellIndex: Map<string, ChildSession[]>;
  onCellAdd: (childId: number, day: Day) => void;
  onChipClick: (s: ChildSession) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 bg-surface px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-700">
          {initials(c.name)}
        </span>
        <span className="truncate text-xs font-semibold text-gray-900">
          {c.name.split(' ')[0]}
        </span>
      </div>
      {DAYS.map((d) => {
        const cell = cellIndex.get(`${c.id}|${d}`) ?? [];
        return (
          <button
            key={d}
            type="button"
            onClick={() => onCellAdd(c.id, d)}
            className="flex min-h-[52px] flex-col items-stretch gap-1 bg-surface p-1.5 text-left hover:bg-gray-50"
          >
            {cell.length === 0 ? (
              <span className="m-auto text-base text-muted">+</span>
            ) : (
              cell.map((s) => {
                const total = (Number(s.funded_hours) || 0) + (Number(s.fee_hours) || 0);
                return (
                  <span
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    title="Click to edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChipClick(s);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        onChipClick(s);
                      }
                    }}
                    className="block"
                  >
                    <Badge variant={TYPE_VARIANT[s.session_type] ?? 'info'}>
                      {s.session_type}
                      {Number(s.funded_hours) > 0 ? ' · funded' : ''}
                    </Badge>
                    <span className="mt-0.5 block text-[10px] text-muted">{total}h total</span>
                  </span>
                );
              })
            )}
          </button>
        );
      })}
    </>
  );
}

// ── Add/edit modal ────────────────────────────────────────────────────────
function SessionModal({
  open,
  editing,
  prefill,
  defaultStartDate,
  onClose,
  onCreate,
  onDelete,
  createSubmitting,
}: {
  open: boolean;
  editing: ChildSession | null;
  prefill: { childId: number; day: Day } | null;
  defaultStartDate: string;
  onClose: () => void;
  onCreate: (data: SessionCreateInput) => void;
  onDelete?: () => void;
  createSubmitting: boolean;
}) {
  const updateSession = useUpdateSession(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit session' : 'Add session'}
      footer={
        editing && onDelete ? (
          <button className="btn-outline btn-sm text-danger" onClick={onDelete}>
            Delete session
          </button>
        ) : undefined
      }
    >
      <SessionForm
        initial={editing ?? undefined}
        prefill={prefill}
        defaultStartDate={defaultStartDate}
        submitting={editing ? updateSession.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateSession.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

function SessionForm({
  initial,
  prefill,
  defaultStartDate,
  onSubmit,
  submitting,
}: {
  initial?: ChildSession;
  prefill?: { childId: number; day: Day } | null;
  defaultStartDate: string;
  onSubmit: (data: SessionCreateInput) => void;
  submitting?: boolean;
}) {
  const { data: children } = useChildren();

  const [childId, setChildId] = useState<number | ''>('');
  const [day, setDay] = useState<Day>('Mon');
  const [sessionType, setSessionType] = useState<SessionType>('Full Day');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [fundedHours, setFundedHours] = useState(0);
  const [feeHours, setFeeHours] = useState(0);
  const [room, setRoom] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setChildId(initial?.child_id ?? prefill?.childId ?? '');
    setDay((initial?.day as Day) ?? prefill?.day ?? 'Mon');
    setSessionType((initial?.session_type as SessionType) ?? 'Full Day');
    setStartTime(initial?.start_time ?? '');
    setEndTime(initial?.end_time ?? '');
    setFundedHours(initial?.funded_hours ?? 0);
    setFeeHours(initial?.fee_hours ?? 0);
    setRoom(initial?.room ?? '');
    setStartDate(initial?.start_date ?? defaultStartDate);
    setEndDate(initial?.end_date ?? '');
    setNotes(initial?.notes ?? '');
  }, [initial, prefill, defaultStartDate]);

  const isCustom = sessionType === 'Custom';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (childId === '') return;
    onSubmit({
      childId,
      day,
      sessionType,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      fundedHours,
      feeHours,
      room: room || undefined,
      startDate,
      endDate: endDate || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Child">
        <select
          value={childId}
          onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : '')}
          required
          className="input"
        >
          <option value="">Select a child…</option>
          {(children ?? [])
            .filter((c) => c.status === 'Active')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Day">
          <select value={day} onChange={(e) => setDay(e.target.value as Day)} className="input">
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Session type">
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as SessionType)}
            className="input"
          >
            {SESSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Times required for Custom sessions (matches schema refine). */}
      <div className="grid grid-cols-2 gap-4">
        <Field label={isCustom ? 'Start time (required)' : 'Start time'}>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required={isCustom}
            className="input"
          />
        </Field>
        <Field label={isCustom ? 'End time (required)' : 'End time'}>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required={isCustom}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Funded hours">
          <input
            type="number"
            step="0.5"
            min="0"
            value={fundedHours}
            onChange={(e) => setFundedHours(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Fee hours">
          <input
            type="number"
            step="0.5"
            min="0"
            value={feeHours}
            onChange={(e) => setFeeHours(Number(e.target.value))}
            className="input"
          />
        </Field>
      </div>

      <Field label="Room">
        <input value={room} onChange={(e) => setRoom(e.target.value)} className="input" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="input"
          />
        </Field>
        <Field label="End date (blank = ongoing)">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input"
          rows={3}
        />
      </Field>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
