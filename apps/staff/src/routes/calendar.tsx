import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  type CalendarEvent,
  type CalendarEventInput,
} from '../features/calendar/useCalendar';
import { Modal, Field, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/calendar')({
  component: CalendarPage,
});

// ── Event types ──────────────────────────────────────────────────────────────
// `event_type` (on calendar_events) is the source of truth for an event's type.
// Selecting a type writes its `event_type` plus the canonical colour, and
// rendering keys off `event.event_type`. Older rows without an `event_type`
// fall back to mapping the stored colour back to a type.

type EventTypeKey = 'closure' | 'bank_holiday' | 'event' | 'term_date' | 'inset_day';

interface TypeMeta {
  label: string;
  color: string;
  icon: string;
}

const CAL_TYPE_META: Record<EventTypeKey, TypeMeta> = {
  closure: { label: 'Closure', color: '#ef4444', icon: '🔒' },
  bank_holiday: { label: 'Bank Holiday', color: '#f59e0b', icon: '🏖️' },
  event: { label: 'Event', color: '#3b82f6', icon: '🎉' },
  term_date: { label: 'Term Date', color: '#10b981', icon: '📚' },
  inset_day: { label: 'Inset Day', color: '#8b5cf6', icon: '👩‍🏫' },
};

const TYPE_ORDER: EventTypeKey[] = [
  'closure',
  'bank_holiday',
  'event',
  'term_date',
  'inset_day',
];

const COLOR_TO_TYPE: Record<string, EventTypeKey> = Object.fromEntries(
  TYPE_ORDER.map((k) => [CAL_TYPE_META[k].color.toLowerCase(), k]),
) as Record<string, EventTypeKey>;

// `event_type` is the source of truth; fall back to colour mapping for old rows.
function typeKeyFor(e: CalendarEvent): EventTypeKey | null {
  if (e.event_type && e.event_type in CAL_TYPE_META) {
    return e.event_type as EventTypeKey;
  }
  return COLOR_TO_TYPE[(e.color || '').toLowerCase()] ?? null;
}

function metaFor(e: CalendarEvent): TypeMeta {
  const key = typeKeyFor(e);
  if (key) return CAL_TYPE_META[key];
  // Unknown type/colour → fall back to the stored colour with the generic event icon.
  return { ...CAL_TYPE_META.event, color: e.color || CAL_TYPE_META.event.color };
}

// ── Date helpers (all ISO yyyy-mm-dd, all-day events) ─────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => new Date().toISOString().split('T')[0];

function fmtCalDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d, 10)} ${short[parseInt(m, 10) - 1]} ${y}`;
}

// An event covers [start_date, end_date]; end_date may be null (single day).
function eventEnd(e: CalendarEvent): string {
  return e.end_date ?? e.start_date;
}
function coversDay(e: CalendarEvent, iso: string): boolean {
  return e.start_date <= iso && eventEnd(e) >= iso;
}

function CalendarPage() {
  const { data: events, isLoading } = useCalendarEvents();
  const createEvent = useCreateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [view, setView] = useState<'month' | 'list'>('month');

  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  const allEvents = events ?? [];

  const navMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };
  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const openAdd = (date?: string) => {
    setEditing(null);
    setPrefillDate(date ?? null);
    setModalOpen(true);
  };
  const openEdit = (e: CalendarEvent) => {
    setEditing(e);
    setPrefillDate(null);
    setModalOpen(true);
  };

  // Upcoming: next 5 events whose span hasn't fully passed.
  const upcoming = useMemo(() => {
    const t = todayIso();
    return allEvents
      .filter((e) => eventEnd(e) >= t)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 5);
  }, [allEvents]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <button className="btn-primary" onClick={() => openAdd()}>
          Add event
        </button>
      </div>

      {/* Toolbar: month nav + legend + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-outline btn-sm" onClick={() => navMonth(-1)} aria-label="Previous month">
            ‹
          </button>
          <h2 className="min-w-[150px] text-center text-base font-bold text-gray-900">
            {MONTHS[month]} {year}
          </h2>
          <button className="btn-outline btn-sm" onClick={() => navMonth(1)} aria-label="Next month">
            ›
          </button>
          <button className="btn-outline btn-sm ml-1" onClick={goToday}>
            Today
          </button>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-3">
          {TYPE_ORDER.map((k) => {
            const m = CAL_TYPE_META[k];
            return (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: m.color }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.label}
              </span>
            );
          })}
        </div>

        <div className="flex gap-1 rounded-lg bg-bg p-1">
          <button
            className={`btn-sm rounded-md ${view === 'month' ? 'btn-primary' : 'text-muted'}`}
            onClick={() => setView('month')}
          >
            Month
          </button>
          <button
            className={`btn-sm rounded-md ${view === 'list' ? 'btn-primary' : 'text-muted'}`}
            onClick={() => setView('list')}
          >
            List
          </button>
        </div>
      </div>

      {/* Upcoming strip */}
      {!isLoading && upcoming.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {upcoming.map((e) => {
            const m = metaFor(e);
            return (
              <button
                key={e.id}
                onClick={() => openEdit(e)}
                className="shrink-0 rounded-lg border p-2 text-left"
                style={{
                  minWidth: 170,
                  maxWidth: 210,
                  backgroundColor: `${m.color}15`,
                  borderColor: `${m.color}44`,
                  borderLeft: `3px solid ${m.color}`,
                }}
              >
                <div className="text-[11px] font-bold uppercase" style={{ color: m.color }}>
                  {m.icon} {m.label}
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold text-gray-900">{e.title}</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {fmtCalDate(e.start_date)}
                  {eventEnd(e) !== e.start_date ? ` – ${fmtCalDate(eventEnd(e))}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : allEvents.length === 0 ? (
        <EmptyState title="No events found" description="Add an event to get started." />
      ) : view === 'month' ? (
        <MonthGrid
          year={year}
          month={month}
          events={allEvents}
          onDayClick={(iso) => openAdd(iso)}
          onEventClick={openEdit}
        />
      ) : (
        <ListView
          year={year}
          month={month}
          events={allEvents}
          onEventClick={openEdit}
          onAdd={() => openAdd()}
          onDelete={(e) => {
            if (confirm(`Delete ${e.title}?`)) deleteEvent.mutate(e.id);
          }}
        />
      )}

      <CalendarModal
        open={modalOpen}
        editing={editing}
        prefillDate={prefillDate}
        onClose={() => setModalOpen(false)}
        createSubmitting={createEvent.isPending}
        onCreate={(data) => createEvent.mutate(data, { onSuccess: () => setModalOpen(false) })}
        onDelete={(id) => {
          if (confirm('Delete this event?')) {
            deleteEvent.mutate(id, { onSuccess: () => setModalOpen(false) });
          }
        }}
      />
    </div>
  );
}

// ── Month grid (Monday-first) ─────────────────────────────────────────────────
function MonthGrid({
  year,
  month,
  events,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  onDayClick: (iso: string) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = firstWeekday === 0 ? 6 : firstWeekday - 1; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayIso();

  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });

  return (
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-border">
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-bold text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (cell.day == null) {
            return <div key={idx} className="min-h-[88px] border-b border-r border-border bg-bg/40" />;
          }
          const iso = isoDay(year, month, cell.day);
          const isToday = iso === today;
          const weekday = new Date(year, month, cell.day).getDay();
          const isWknd = weekday === 0 || weekday === 6;
          const dayEvts = events.filter((e) => coversDay(e, iso));

          return (
            <button
              key={idx}
              onClick={() => onDayClick(iso)}
              className={`min-h-[88px] border-b border-r border-border p-1.5 text-left align-top hover:bg-primary-light ${
                isWknd ? 'bg-gray-50' : 'bg-surface'
              }`}
            >
              <div
                className={
                  isToday
                    ? 'flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white'
                    : `text-[13px] font-semibold ${isWknd ? 'text-muted' : 'text-gray-900'}`
                }
              >
                {cell.day}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {dayEvts.slice(0, 3).map((e) => {
                  const m = metaFor(e);
                  return (
                    <span
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') {
                          ev.stopPropagation();
                          onEventClick(e);
                        }
                      }}
                      title={e.title}
                      className="truncate rounded px-1 py-px text-[10.5px] font-semibold text-white"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.icon} {e.title}
                    </span>
                  );
                })}
                {dayEvts.length > 3 && (
                  <span className="pl-1 text-[10px] text-muted">+{dayEvts.length - 3} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── List view (events within the visible month) ──────────────────────────────
function ListView({
  year,
  month,
  events,
  onEventClick,
  onAdd,
  onDelete,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onAdd: () => void;
  onDelete: (e: CalendarEvent) => void;
}) {
  const mFrom = isoDay(year, month, 1);
  const mTo = isoDay(year, month, new Date(year, month + 1, 0).getDate());
  const monthEvents = events
    .filter((e) => e.start_date <= mTo && eventEnd(e) >= mFrom)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  if (monthEvents.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState title="No events this month" description="Add an event for this month." />
        <div className="flex justify-center">
          <button className="btn-primary" onClick={onAdd}>
            Add event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      {monthEvents.map((e) => {
        const m = metaFor(e);
        const span =
          eventEnd(e) === e.start_date
            ? fmtCalDate(e.start_date)
            : `${fmtCalDate(e.start_date)} – ${fmtCalDate(eventEnd(e))}`;
        return (
          <div
            key={e.id}
            className="flex items-center gap-4 border-b border-border px-4 py-3 hover:bg-primary-light"
          >
            <span className="h-12 w-1.5 shrink-0 rounded" style={{ backgroundColor: m.color }} />
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
              style={{ backgroundColor: `${m.color}20` }}
            >
              {m.icon}
            </span>
            <button onClick={() => onEventClick(e)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-bold text-gray-900">{e.title}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">{span}</div>
              {e.description && (
                <div className="mt-0.5 truncate text-xs italic text-muted">{e.description}</div>
              )}
            </button>
            <span
              className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: `${m.color}20`, color: m.color }}
            >
              {m.label}
            </span>
            <button className="btn-outline btn-sm text-danger" onClick={() => onDelete(e)}>
              Delete
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Add/edit modal ────────────────────────────────────────────────────────────
function CalendarModal({
  open,
  editing,
  prefillDate,
  onClose,
  onCreate,
  onDelete,
  createSubmitting,
}: {
  open: boolean;
  editing: CalendarEvent | null;
  prefillDate: string | null;
  onClose: () => void;
  onCreate: (data: CalendarEventInput) => void;
  onDelete: (id: number) => void;
  createSubmitting: boolean;
}) {
  const updateEvent = useUpdateCalendarEvent(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.title}` : 'Add event'}>
      <CalendarForm
        initial={editing ?? undefined}
        prefillDate={prefillDate}
        submitting={editing ? updateEvent.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateEvent.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
        onDelete={editing ? () => onDelete(editing.id) : undefined}
      />
    </Modal>
  );
}

function CalendarForm({
  initial,
  prefillDate,
  onSubmit,
  onDelete,
  submitting,
}: {
  initial?: CalendarEvent;
  prefillDate: string | null;
  onSubmit: (data: CalendarEventInput) => void;
  onDelete?: () => void;
  submitting?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventTypeKey>('event');
  const [color, setColor] = useState(CAL_TYPE_META.event.color);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const t = (initial ? typeKeyFor(initial) : null) ?? 'event';
    setTitle(initial?.title ?? '');
    setType(t);
    setColor(initial?.color ?? CAL_TYPE_META[t].color);
    setStartDate(initial?.start_date ?? prefillDate ?? todayIso());
    setEndDate(initial?.end_date ?? prefillDate ?? '');
    setDescription(initial?.description ?? '');
  }, [initial, prefillDate]);

  // Selecting a type sets `eventType` (source of truth) and its canonical colour.
  const onTypeChange = (k: EventTypeKey) => {
    setType(k);
    setColor(CAL_TYPE_META[k].color);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let end = endDate || startDate;
    if (end < startDate) end = startDate;
    onSubmit({
      title,
      startDate,
      endDate: end,
      allDay: true,
      color,
      eventType: type,
      description: description || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Christmas Closure, Spring Term Starts…"
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value as EventTypeKey)}
            className="input"
          >
            {TYPE_ORDER.map((k) => (
              <option key={k} value={k}>
                {CAL_TYPE_META[k].icon} {CAL_TYPE_META[k].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Colour">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="input h-10 w-14 p-1"
            />
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setColor(CAL_TYPE_META[type].color)}
            >
              Auto
            </button>
          </div>
        </Field>
      </div>

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
        <Field label="End date">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input"
          rows={2}
        />
      </Field>

      {initial?.created_by && (
        <p className="text-[11.5px] text-muted">Added by {initial.created_by}</p>
      )}

      <div className="flex items-center justify-between">
        {onDelete ? (
          <button type="button" className="btn-outline btn-sm text-danger" onClick={onDelete}>
            Delete
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add event'}
        </button>
      </div>
    </form>
  );
}
