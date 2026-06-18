import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useFireDrills,
  useCreateFireDrill,
  useUpdateFireDrill,
  useDeleteFireDrill,
  type FireDrill,
  type FireDrillInput,
} from '../features/fire-register/useFireRegister';
import { Modal, Spinner, EmptyState, Badge, Field, StatCard } from '../components/ui';
import { fmtDate } from '../lib/date';

export const Route = createFileRoute('/fire-register')({ component: FireRegisterPage });

// Parse an "mm:ss" (or plain seconds) evacuation time into total seconds.
function evacToSeconds(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const [m, s] = trimmed.split(':');
    const mins = Number(m);
    const secs = Number(s);
    if (Number.isNaN(mins) || Number.isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

function formatSeconds(total: number): string {
  const mins = Math.floor(total / 60);
  const secs = Math.round(total % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function FireRegisterPage() {
  const { data: drills, isLoading } = useFireDrills();
  const createDrill = useCreateFireDrill();
  const deleteDrill = useDeleteFireDrill();

  const [editing, setEditing] = useState<FireDrill | null>(null);
  const [open, setOpen] = useState(false);

  const all = drills ?? [];

  // Stats summary (mirrors the reference fire-drill summary: total drills,
  // last drill date, average evacuation time, drills this term/year).
  const stats = useMemo(() => {
    const total = all.length;

    // Latest drill by date.
    const sorted = [...all].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const lastDate = sorted[0]?.date ?? null;

    // Average evacuation time across drills that recorded one.
    const evacSeconds = all
      .map((d) => evacToSeconds(d.evacuation_time))
      .filter((n): n is number => n != null);
    const avgEvac =
      evacSeconds.length > 0
        ? formatSeconds(evacSeconds.reduce((sum, n) => sum + n, 0) / evacSeconds.length)
        : '—';

    // Drills in the current calendar year.
    const year = new Date().getFullYear();
    const thisYear = all.filter((d) => new Date(d.date).getFullYear() === year).length;

    return {
      total,
      lastDate: lastDate ? fmtDate(lastDate) : '—',
      avgEvac,
      thisYear,
    };
  }, [all]);

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (d: FireDrill) => {
    setEditing(d);
    setOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Fire Register</h1>
        <button className="btn-primary" onClick={openAdd}>
          Record drill
        </button>
      </div>

      {/* Stat cards (mirrors the reference drill summary). */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total drills" value={stats.total} />
        <StatCard label="Last drill" value={stats.lastDate} />
        <StatCard label="Avg evacuation" value={stats.avgEvac} hint="mm:ss" />
        <StatCard label="This year" value={stats.thisYear} />
      </div>

      {isLoading ? (
        <Spinner />
      ) : all.length === 0 ? (
        <EmptyState title="No fire drills recorded" description="Record a drill to start the register." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Date / Time</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Evacuation</th>
                <th className="px-4 py-3 font-medium">Present</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Conducted by</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {all.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium">{fmtDate(d.date)}</div>
                    {d.time && <div className="text-xs text-muted">{d.time}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize">{d.drill_type}</td>
                  <td className="px-4 py-3">{d.evacuation_time || '—'}</td>
                  <td className="px-4 py-3">{d.persons_present ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={d.all_clear ? 'success' : 'danger'}>
                      {d.all_clear ? 'All clear' : 'Issues'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{d.conducted_by || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button className="text-sm text-primary" onClick={() => openEdit(d)}>
                        Edit
                      </button>
                      <button
                        className="text-sm text-danger"
                        onClick={() => {
                          if (confirm(`Delete the drill on ${fmtDate(d.date)}?`)) deleteDrill.mutate(d.id);
                        }}
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

      <DrillModal
        open={open}
        editing={editing}
        onClose={() => setOpen(false)}
        createSubmitting={createDrill.isPending}
        onCreate={(data) => createDrill.mutate(data, { onSuccess: () => setOpen(false) })}
      />
    </div>
  );
}

function DrillModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: FireDrill | null;
  onClose: () => void;
  onCreate: (data: FireDrillInput) => void;
  createSubmitting: boolean;
}) {
  const updateDrill = useUpdateFireDrill(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit drill' : 'Record fire drill'}>
      <DrillForm
        initial={editing}
        submitting={editing ? updateDrill.isPending : createSubmitting}
        onSubmit={(data) => (editing ? updateDrill.mutate(data, { onSuccess: onClose }) : onCreate(data))}
      />
    </Modal>
  );
}

function DrillForm({
  initial,
  submitting,
  onSubmit,
}: {
  initial: FireDrill | null;
  submitting: boolean;
  onSubmit: (data: FireDrillInput) => void;
}) {
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(initial?.time ?? '');
  const [drillType, setDrillType] = useState(initial?.drill_type ?? 'scheduled');
  const [evacuationTime, setEvacuationTime] = useState(initial?.evacuation_time ?? '');
  const [personsPresent, setPersonsPresent] = useState(
    initial?.persons_present != null ? String(initial.persons_present) : '',
  );
  const [conductedBy, setConductedBy] = useState(initial?.conducted_by ?? '');
  const [allClear, setAllClear] = useState(initial?.all_clear ?? true);
  const [issues, setIssues] = useState(initial?.issues ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      date,
      time: time || undefined,
      drillType,
      evacuationTime: evacuationTime || undefined,
      personsPresent: personsPresent ? Number(personsPresent) : undefined,
      conductedBy: conductedBy || undefined,
      allClear,
      issues: issues || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input className="input w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Time">
          <input className="input w-full" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select className="input w-full" value={drillType} onChange={(e) => setDrillType(e.target.value)}>
            <option value="scheduled">Scheduled</option>
            <option value="unannounced">Unannounced</option>
          </select>
        </Field>
        <Field label="Evacuation time (mm:ss)">
          <input
            className="input w-full"
            placeholder="2:30"
            value={evacuationTime}
            onChange={(e) => setEvacuationTime(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Persons present">
          <input
            className="input w-full"
            type="number"
            min={0}
            value={personsPresent}
            onChange={(e) => setPersonsPresent(e.target.value)}
          />
        </Field>
        <Field label="Conducted by">
          <input
            className="input w-full"
            value={conductedBy}
            onChange={(e) => setConductedBy(e.target.value)}
            placeholder="Staff member"
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={allClear} onChange={(e) => setAllClear(e.target.checked)} />
        All clear
      </label>
      {!allClear && (
        <Field label="Issues noted">
          <textarea className="input w-full" rows={2} value={issues} onChange={(e) => setIssues(e.target.value)} />
        </Field>
      )}
      <Field label="Notes">
        <textarea className="input w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save drill'}
        </button>
      </div>
    </form>
  );
}
