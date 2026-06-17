import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dailyLogCreateSchema, type DailyLogCreateInput } from '@sprout/schemas';
import { useChildren } from '../features/children/useChildren';
import {
  useDailyLogs,
  useCreateDailyLog,
  useUpdateDailyLog,
  useDeleteDailyLog,
  type DailyLog,
} from '../features/daily-logs/useDailyLogs';
import { Field, Modal, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/daily-logs')({ component: DailyLogsPage });

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

type LogType = DailyLog['type'];
const LOG_TYPES: LogType[] = ['meal', 'sleep', 'nappy', 'mood', 'activity', 'note'];

// Type icons / colours mirror the reference app's daily-logs view.
const LOG_ICONS: Record<LogType, string> = {
  meal: '🍽️',
  sleep: '😴',
  nappy: '🧷',
  mood: '😊',
  activity: '🎨',
  note: '📝',
};

const LOG_BG: Record<LogType, string> = {
  meal: 'rgba(40,199,111,.12)',
  sleep: 'rgba(115,103,240,.12)',
  nappy: 'rgba(255,159,67,.12)',
  mood: 'rgba(0,207,232,.12)',
  activity: 'rgba(79,142,247,.12)',
  note: 'rgba(107,122,153,.12)',
};

const LOG_TEXT: Record<LogType, string> = {
  meal: '#1a9e55',
  sleep: '#5a50c8',
  nappy: '#d97c00',
  mood: '#0097ab',
  activity: '#2f6fde',
  note: '#6b7a99',
};

// Mood colour/emoji mapping (reference app ~line 2433).
const MOOD_MAP: Record<string, { icon: string; col: string; text: string; label: string }> = {
  happy: { icon: '😄', col: '#dcfce7', text: '#166534', label: 'Happy' },
  excited: { icon: '🤩', col: '#fef9c3', text: '#713f12', label: 'Excited' },
  content: { icon: '😊', col: '#e0f2fe', text: '#075985', label: 'Content' },
  tired: { icon: '😴', col: '#ede9fe', text: '#4c1d95', label: 'Tired' },
  unsettled: { icon: '😟', col: '#fef2f2', text: '#991b1b', label: 'Unsettled' },
  upset: { icon: '😢', col: '#fff1f2', text: '#9f1239', label: 'Upset' },
  calm: { icon: '😌', col: '#f0fdf4', text: '#14532d', label: 'Calm' },
};

const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '—');

function DailyLogsPage() {
  const { data: children } = useChildren();
  const [childId, setChildId] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(isoDate(new Date()));
  const [activeTypes, setActiveTypes] = useState<Set<LogType>>(new Set(LOG_TYPES));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DailyLog | null>(null);

  const { data: logs, isLoading } = useDailyLogs({ childId, date });
  const createLog = useCreateDailyLog();
  const updateLog = useUpdateDailyLog();
  const deleteLog = useDeleteDailyLog();

  const allTypesActive = activeTypes.size === LOG_TYPES.length;
  const toggleType = (t: LogType) =>
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      // Never allow an all-empty filter — reset to all when emptied.
      return next.size === 0 ? new Set(LOG_TYPES) : next;
    });

  const filtered = useMemo(
    () => (logs ?? []).filter((l) => allTypesActive || activeTypes.has(l.type)),
    [logs, activeTypes, allTypesActive],
  );

  // Day summary tiles (reference app ~line 2485).
  const summary = useMemo(() => {
    const count = (t: LogType) => (logs ?? []).filter((l) => l.type === t).length;
    return {
      meals: count('meal'),
      naps: count('sleep'),
      nappies: count('nappy'),
      activities: count('activity'),
    };
  }, [logs]);

  // Latest mood entry → mood banner.
  const mood = useMemo(() => {
    const moods = (logs ?? []).filter((l) => l.type === 'mood');
    const last = moods[0]; // list is sorted date/time DESC
    if (!last) return null;
    const key = (last.details ?? '').toLowerCase().trim();
    const m = MOOD_MAP[key];
    return {
      ...(m ?? { icon: '😊', col: '#e0f2fe', text: '#075985', label: last.details || 'Mood' }),
      by: last.added_by,
    };
  }, [logs]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (log: DailyLog) => {
    setEditing(log);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Daily Logs</h1>
        <button className="btn-primary" onClick={openAdd} disabled={!childId}>
          Add log
        </button>
      </div>

      {/* Filter bar: child + date + type chips */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input max-w-xs"
          value={childId ?? ''}
          onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Select child…</option>
          {children?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input max-w-[12rem]"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {LOG_TYPES.map((t) => {
            const on = activeTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition ${
                  on ? '' : 'border-border bg-transparent text-muted opacity-60'
                }`}
                style={
                  on
                    ? { backgroundColor: LOG_BG[t], color: LOG_TEXT[t], borderColor: LOG_TEXT[t] }
                    : undefined
                }
              >
                <span>{LOG_ICONS[t]}</span>
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {!childId ? (
        <EmptyState title="Select a child" description="Choose a child to view their daily logs." />
      ) : isLoading ? (
        <Spinner />
      ) : !logs?.length ? (
        <EmptyState title="No logs" description="Add a log entry for this child and date." />
      ) : (
        <div className="space-y-4">
          {/* Day summary tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: '🍽️', val: summary.meals, label: 'Meals', col: '#dcfce7', tc: '#166534' },
              { icon: '😴', val: summary.naps, label: 'Naps', col: '#ede9fe', tc: '#4c1d95' },
              { icon: '🧷', val: summary.nappies, label: 'Nappies', col: '#fef3c7', tc: '#92400e' },
              {
                icon: '🎨',
                val: summary.activities,
                label: 'Activities',
                col: '#e0f2fe',
                tc: '#075985',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: s.col }}
              >
                <div className="text-xl">{s.icon}</div>
                <div className="text-xl font-bold leading-tight" style={{ color: s.tc }}>
                  {s.val}
                </div>
                <div className="text-xs font-semibold opacity-80" style={{ color: s.tc }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Mood banner */}
          {mood && (
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ backgroundColor: mood.col, border: `1px solid ${mood.col}` }}
            >
              <div className="text-4xl">{mood.icon}</div>
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: mood.text }}
                >
                  Today&apos;s Mood
                </div>
                <div className="text-lg font-extrabold" style={{ color: mood.text }}>
                  {mood.label}
                </div>
                {mood.by && (
                  <div className="mt-0.5 text-xs opacity-70" style={{ color: mood.text }}>
                    Noted by {mood.by}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chronological log list */}
          {filtered.length === 0 ? (
            <EmptyState title="No logs match" description="No logs match the selected types." />
          ) : (
            <ol className="space-y-2">
              {filtered.map((log) => (
                <li
                  key={log.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: LOG_BG[log.type] }}
                  >
                    {LOG_ICONS[log.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                        style={{ backgroundColor: LOG_BG[log.type], color: LOG_TEXT[log.type] }}
                      >
                        {log.type}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted">{fmtTime(log.time)}</span>
                        <button
                          className="text-xs text-primary"
                          onClick={() => openEdit(log)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-danger"
                          onClick={() => {
                            if (confirm('Delete this log entry?')) deleteLog.mutate(log.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {log.details && (
                      <p className="mt-1 text-sm text-gray-900">{log.details}</p>
                    )}
                    {log.added_by && (
                      <p className="mt-0.5 text-xs text-muted">By {log.added_by}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {childId && (
        <LogModal
          open={modalOpen}
          editing={editing}
          onClose={closeModal}
          childId={childId}
          date={date}
          submitting={editing ? updateLog.isPending : createLog.isPending}
          onSubmit={(data) => {
            if (editing) {
              updateLog.mutate({ id: editing.id, data }, { onSuccess: closeModal });
            } else {
              createLog.mutate(data, { onSuccess: closeModal });
            }
          }}
        />
      )}
    </div>
  );
}

function LogModal({
  open,
  editing,
  onClose,
  childId,
  date,
  onSubmit,
  submitting,
}: {
  open: boolean;
  editing: DailyLog | null;
  onClose: () => void;
  childId: number;
  date: string;
  onSubmit: (data: DailyLogCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DailyLogCreateInput>({
    resolver: zodResolver(dailyLogCreateSchema),
    // Remount via `key` (below) refreshes defaults when switching add/edit.
    defaultValues: editing
      ? {
          childId: editing.child_id,
          date: editing.date.slice(0, 10),
          time: editing.time ?? undefined,
          type: editing.type,
          details: editing.details ?? undefined,
        }
      : { childId, date, type: 'note' },
  });

  return (
    <Modal
      key={editing?.id ?? 'new'}
      open={open}
      onClose={onClose}
      title={editing ? 'Edit log' : 'Add log'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register('childId', { valueAsNumber: true })} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" error={errors.type?.message}>
            <select {...register('type')} className="input">
              {LOG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LOG_ICONS[t]} {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date" error={errors.date?.message}>
            <input type="date" {...register('date')} className="input" />
          </Field>
        </div>
        <Field label="Time" error={errors.time?.message}>
          <input type="time" {...register('time')} className="input" />
        </Field>
        <Field label="Details" error={errors.details?.message}>
          <textarea
            {...register('details')}
            className="input"
            rows={3}
            placeholder="e.g. Slept for 45 mins, ate well, happy mood…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-sm" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
