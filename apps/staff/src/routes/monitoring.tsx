import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useMonitoring,
  useCreateMark,
  useDeleteMark,
  type DailyLog,
  type MarkCreateInput,
} from '../features/monitoring/useMonitoring';
import { useChildren, type Child } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/monitoring')({
  component: MonitoringPage,
});

// Check categories shown as grid columns. `note` is logged via the mark modal
// but is not a grid column (free-text, not a daily "check").
const CATEGORIES = ['meal', 'sleep', 'nappy', 'mood', 'activity'] as const;
type Category = (typeof CATEGORIES)[number];

const MARK_TYPES: DailyLog['type'][] = ['meal', 'sleep', 'nappy', 'mood', 'activity', 'note'];

const CATEGORY_META: Record<
  Category,
  { label: string; icon: string; variant: 'success' | 'info' | 'warning' }
> = {
  meal: { label: 'Meals', icon: '🍽️', variant: 'success' },
  sleep: { label: 'Sleep', icon: '😴', variant: 'info' },
  nappy: { label: 'Nappy', icon: '🧷', variant: 'warning' },
  mood: { label: 'Mood', icon: '🙂', variant: 'info' },
  activity: { label: 'Activity', icon: '🎨', variant: 'success' },
};

// Avatar colour/initials helpers mirror clr()/ini() in the reference app.
// The reference used .c0–.c7 CSS classes; those aren't in this app's CSS, so
// we derive a deterministic background colour inline instead.
const AVATAR_COLORS = [
  '#4f8ef7',
  '#28c76f',
  '#ff9f43',
  '#ea5455',
  '#7367f0',
  '#00cfe8',
  '#e83e8c',
  '#9c27b0',
];
function avatarColor(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}
function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Per-child, per-category roll-up of the day's logs.
interface ChildRow {
  child: Child;
  counts: Record<Category, number>;
  // Newest logs first, for the detail drawer / delete actions.
  logs: DailyLog[];
  total: number;
}

function MonitoringPage() {
  const [date, setDate] = useState(today());
  const { data: logs, isLoading } = useMonitoring(date);
  const { data: children, isLoading: childrenLoading } = useChildren();

  const [markChild, setMarkChild] = useState<Child | null>(null);
  const [detailRow, setDetailRow] = useState<ChildRow | null>(null);

  // Build the grid client-side: active children × categories.
  const rows = useMemo<ChildRow[]>(() => {
    const active = (children ?? []).filter((c) => c.status === 'Active');
    const byChild = new Map<number, DailyLog[]>();
    for (const log of logs ?? []) {
      const list = byChild.get(log.child_id) ?? [];
      list.push(log);
      byChild.set(log.child_id, list);
    }
    return active
      .map((child) => {
        const childLogs = byChild.get(child.id) ?? [];
        const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
          Category,
          number
        >;
        for (const log of childLogs) {
          if (log.type in counts) counts[log.type as Category]++;
        }
        return {
          child,
          counts,
          logs: childLogs,
          total: childLogs.length,
        };
      })
      .sort((a, b) => a.child.name.localeCompare(b.child.name));
  }, [children, logs]);

  // Column totals for the footer summary.
  const totals = useMemo(() => {
    const t = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    for (const row of rows) for (const c of CATEGORIES) t[c] += row.counts[c];
    return t;
  }, [rows]);

  const loading = isLoading || childrenLoading;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Monitoring</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            aria-label="Monitoring date"
          />
          <button className="btn-primary" onClick={() => setMarkChild(rows[0]?.child ?? null)}>
            Add mark
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No active children"
          description="Add active children to start recording their daily checks."
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-left">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Child
                </th>
                {CATEGORIES.map((c) => (
                  <th
                    key={c}
                    className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wide text-muted"
                  >
                    <span className="mr-1">{CATEGORY_META[c].icon}</span>
                    {CATEGORY_META[c].label}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Total
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.child.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {row.child.photo_url ? (
                        <img
                          src={row.child.photo_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: avatarColor(row.child.name) }}
                        >
                          {initials(row.child.name)}
                        </span>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">{row.child.name}</div>
                        {row.child.room && (
                          <div className="text-xs text-muted">{row.child.room}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  {CATEGORIES.map((c) => (
                    <td key={c} className="px-3 py-3 text-center">
                      <CheckCell category={c} count={row.counts[c]} />
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center font-semibold text-gray-900">
                    {row.total}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        className="btn-outline btn-sm"
                        onClick={() => setMarkChild(row.child)}
                      >
                        Mark
                      </button>
                      <button
                        className="btn-outline btn-sm"
                        disabled={row.total === 0}
                        onClick={() => setDetailRow(row)}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-bg">
                <td className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  All children
                </td>
                {CATEGORIES.map((c) => (
                  <td key={c} className="px-3 py-2 text-center text-xs font-semibold text-gray-900">
                    {totals[c]}
                  </td>
                ))}
                <td className="px-3 py-2 text-center text-xs font-semibold text-gray-900">
                  {CATEGORIES.reduce((sum, c) => sum + totals[c], 0)}
                </td>
                <td className="px-4 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <AddMarkModal
        open={markChild !== null}
        child={markChild}
        date={date}
        onClose={() => setMarkChild(null)}
      />
      <ChildDayModal row={detailRow} date={date} onClose={() => setDetailRow(null)} />
    </div>
  );
}

// A grid cell: green badge with count if the category was logged, muted dash if not.
function CheckCell({ category, count }: { category: Category; count: number }) {
  if (count === 0) {
    return <span className="text-muted">—</span>;
  }
  return (
    <Badge variant={CATEGORY_META[category].variant}>
      {CATEGORY_META[category].icon} {count}
    </Badge>
  );
}

function AddMarkModal({
  open,
  child,
  date,
  onClose,
}: {
  open: boolean;
  child: Child | null;
  date: string;
  onClose: () => void;
}) {
  const { data: children } = useChildren();
  const createMark = useCreateMark();

  const [childId, setChildId] = useState<number | ''>('');
  const [type, setType] = useState<DailyLog['type']>('meal');
  const [time, setTime] = useState('');
  const [details, setDetails] = useState('');

  // Sync the pre-selected child each time the modal opens for a row.
  const activeChildId = childId === '' ? (child?.id ?? '') : childId;
  const isToday = date === today();

  const reset = () => {
    setChildId('');
    setType('meal');
    setTime('');
    setDetails('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeChildId === '') return;
    const data: MarkCreateInput = {
      childId: Number(activeChildId),
      type,
      time: time || undefined,
      details: details || undefined,
    };
    createMark.mutate(data, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add daily check">
      <form onSubmit={submit} className="space-y-4">
        {!isToday && (
          // The POST endpoint always inserts for CURRENT_DATE; it cannot
          // backdate a mark to the selected day.
          <p className="rounded-lg bg-warning-light px-3 py-2 text-xs text-warning">
            Marks are always recorded for today. Switch the date back to today to add a check.
            {/* TODO: needs POST /monitoring to accept a `date` to log historic checks. */}
          </p>
        )}
        <Field label="Child">
          <select
            value={activeChildId}
            onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : '')}
            className="input"
            required
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
          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DailyLog['type'])}
              className="input"
            >
              {MARK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Time">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <Field label="Details">
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="input"
            rows={3}
            placeholder="e.g. Ate all lunch, slept 12:30–14:00"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={createMark.isPending || activeChildId === '' || !isToday}
          >
            {createMark.isPending ? 'Saving…' : 'Save check'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Drill-in: every logged mark for one child on the selected day, with delete.
function ChildDayModal({
  row,
  date,
  onClose,
}: {
  row: ChildRow | null;
  date: string;
  onClose: () => void;
}) {
  const deleteMark = useDeleteMark();
  if (!row) return null;

  const TYPE_VARIANT: Record<DailyLog['type'], 'success' | 'info' | 'warning' | 'muted'> = {
    meal: 'success',
    sleep: 'info',
    nappy: 'warning',
    mood: 'info',
    activity: 'success',
    note: 'muted',
  };

  return (
    <Modal open={row !== null} onClose={onClose} title={`${row.child.name} — ${date}`}>
      {row.logs.length === 0 ? (
        <EmptyState title="No checks logged" />
      ) : (
        <ul className="space-y-2">
          {row.logs.map((m) => (
            <li
              key={m.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={TYPE_VARIANT[m.type]}>{m.type}</Badge>
                  <span className="text-xs text-muted">{m.time ?? '—'}</span>
                </div>
                {m.details && <p className="mt-1 text-sm text-gray-900">{m.details}</p>}
                {m.added_by && <p className="mt-0.5 text-xs text-muted">by {m.added_by}</p>}
              </div>
              <button
                className="text-sm text-danger"
                onClick={() => {
                  if (confirm('Delete this mark?')) deleteMark.mutate(m.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
