import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useMonitoring,
  useCreateMark,
  useDeleteMark,
  type DailyLog,
  type MarkCreateInput,
} from '../features/monitoring/useMonitoring';
import { useChildren } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/monitoring')({
  component: MonitoringPage,
});

const MARK_TYPES: DailyLog['type'][] = ['meal', 'sleep', 'nappy', 'mood', 'activity', 'note'];

const TYPE_VARIANT: Record<DailyLog['type'], 'success' | 'info' | 'warning' | 'muted'> = {
  meal: 'success',
  sleep: 'info',
  nappy: 'warning',
  mood: 'info',
  activity: 'success',
  note: 'muted',
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function MonitoringPage() {
  const [date, setDate] = useState(today());
  const { data: logs, isLoading } = useMonitoring(date);
  const { data: children } = useChildren();
  const deleteMark = useDeleteMark();

  const [modalOpen, setModalOpen] = useState(false);

  const childName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of children ?? []) map.set(c.id, c.name);
    return map;
  }, [children]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Monitoring</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            Add mark
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (logs ?? []).length === 0 ? (
        <EmptyState
          title="No marks for this date"
          description="Add a daily check mark to get started."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Details</th>
                <th className="px-4 py-2 font-medium">Added by</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-gray-900">
                    {childName.get(m.child_id) ?? `Child #${m.child_id}`}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={TYPE_VARIANT[m.type]}>{m.type}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted">{m.time ?? '—'}</td>
                  <td className="px-4 py-2 text-muted">{m.details || '—'}</td>
                  <td className="px-4 py-2 text-muted">{m.added_by || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-sm text-danger"
                      onClick={() => {
                        if (confirm('Delete this mark?')) deleteMark.mutate(m.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddMarkModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function AddMarkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: children } = useChildren();
  const createMark = useCreateMark();

  const [childId, setChildId] = useState<number | ''>('');
  const [type, setType] = useState<DailyLog['type']>('meal');
  const [time, setTime] = useState('');
  const [details, setDetails] = useState('');

  const reset = () => {
    setChildId('');
    setType('meal');
    setTime('');
    setDetails('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (childId === '') return;
    const data: MarkCreateInput = {
      childId,
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
    <Modal open={open} onClose={onClose} title="Add mark">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Child">
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : '')}
            className="input"
            required
          >
            <option value="">Select a child…</option>
            {(children ?? []).map((c) => (
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
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Details">
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="input"
            rows={3}
          />
        </Field>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={createMark.isPending}>
            {createMark.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
