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
import { useChildren } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/sessions')({
  component: SessionsPage,
});

const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SESSION_TYPES: SessionType[] = ['AM', 'PM', 'Full Day', 'Custom'];

function SessionsPage() {
  const { data: sessions, isLoading } = useSessions();
  const { data: children } = useChildren();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();

  const [editing, setEditing] = useState<ChildSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const childName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of children ?? []) map.set(c.id, c.name);
    return map;
  }, [children]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (s: ChildSession) => {
    setEditing(s);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Sessions</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add session
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (sessions ?? []).length === 0 ? (
        <EmptyState title="No sessions found" description="Add a session to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(sessions ?? []).map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">
                    {childName.get(s.child_id) ?? `Child #${s.child_id}`}
                  </h2>
                  <Badge variant="info">{s.day}</Badge>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-primary" onClick={() => openEdit(s)}>
                    Edit
                  </button>
                  <button
                    className="text-sm text-danger"
                    onClick={() => {
                      if (confirm('Delete this session?')) deleteSession.mutate(s.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="mt-1 text-sm text-muted">
                {s.session_type}
                {s.start_time && s.end_time ? ` · ${s.start_time}–${s.end_time}` : ''}
              </p>
              {s.room && <p className="mt-1 text-sm text-muted">Room: {s.room}</p>}
              <p className="mt-2 text-sm text-gray-700">
                Funded: {s.funded_hours}h · Fee: {s.fee_hours}h
              </p>
              <p className="mt-1 text-xs text-muted">
                From {s.start_date}
                {s.end_date ? ` to ${s.end_date}` : ''}
              </p>
              {s.notes && <p className="mt-2 text-sm text-gray-700">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <SessionModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createSession.isPending}
        onCreate={(data) => createSession.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function SessionModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: ChildSession | null;
  onClose: () => void;
  onCreate: (data: SessionCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateSession = useUpdateSession(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit session' : 'Add session'}>
      <SessionForm
        initial={editing ?? undefined}
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
  onSubmit,
  submitting,
}: {
  initial?: ChildSession;
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
    setChildId(initial?.child_id ?? '');
    setDay((initial?.day as Day) ?? 'Mon');
    setSessionType((initial?.session_type as SessionType) ?? 'Full Day');
    setStartTime(initial?.start_time ?? '');
    setEndTime(initial?.end_time ?? '');
    setFundedHours(initial?.funded_hours ?? 0);
    setFeeHours(initial?.fee_hours ?? 0);
    setRoom(initial?.room ?? '');
    setStartDate(initial?.start_date ?? '');
    setEndDate(initial?.end_date ?? '');
    setNotes(initial?.notes ?? '');
  }, [initial]);

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
          {(children ?? []).map((c) => (
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start time">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="End time">
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
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
        <Field label="End date">
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
