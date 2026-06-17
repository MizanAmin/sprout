import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dailyLogCreateSchema, type DailyLogCreateInput } from '@sprout/schemas';
import { useChildren } from '../features/children/useChildren';
import {
  useDailyLogs,
  useCreateDailyLog,
  useDeleteDailyLog,
} from '../features/daily-logs/useDailyLogs';
import { Field, Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/daily-logs')({ component: DailyLogsPage });

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const LOG_TYPES = ['meal', 'sleep', 'nappy', 'mood', 'activity', 'note'] as const;

function DailyLogsPage() {
  const { data: children } = useChildren();
  const [childId, setChildId] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(isoDate(new Date()));
  const [modalOpen, setModalOpen] = useState(false);

  const { data: logs, isLoading } = useDailyLogs({ childId, date });
  const createLog = useCreateDailyLog();
  const deleteLog = useDeleteDailyLog();

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Daily Logs</h1>
        <button className="btn-primary" onClick={() => setModalOpen(true)} disabled={!childId}>
          Add log
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
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
      </div>

      {!childId ? (
        <EmptyState title="Select a child" description="Choose a child to view their daily logs." />
      ) : isLoading ? (
        <Spinner />
      ) : !logs?.length ? (
        <EmptyState title="No logs" description="Add a log entry for this child and date." />
      ) : (
        <ol className="space-y-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <span className="w-12 shrink-0 text-xs text-muted">{log.time ?? '—'}</span>
              <Badge variant="info">{log.type}</Badge>
              <span className="flex-1 text-sm text-gray-900">{log.details}</span>
              <button
                className="text-sm text-danger"
                onClick={() => {
                  if (confirm('Delete this log entry?')) deleteLog.mutate(log.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ol>
      )}

      {childId && (
        <AddLogModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          childId={childId}
          date={date}
          submitting={createLog.isPending}
          onSubmit={(data) => createLog.mutate(data, { onSuccess: () => setModalOpen(false) })}
        />
      )}
    </div>
  );
}

function AddLogModal({
  open,
  onClose,
  childId,
  date,
  onSubmit,
  submitting,
}: {
  open: boolean;
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
    defaultValues: { childId, date, type: 'note' },
  });

  return (
    <Modal open={open} onClose={onClose} title="Add log">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register('childId', { valueAsNumber: true })} />
        <input type="hidden" {...register('date')} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" error={errors.type?.message}>
            <select {...register('type')} className="input">
              {LOG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Time" error={errors.time?.message}>
            <input type="time" {...register('time')} className="input" />
          </Field>
        </div>
        <Field label="Details" error={errors.details?.message}>
          <textarea {...register('details')} className="input" rows={3} />
        </Field>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
