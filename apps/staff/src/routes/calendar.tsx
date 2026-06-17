import { useEffect, useState } from 'react';
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

function CalendarPage() {
  const { data: events, isLoading } = useCalendarEvents();
  const createEvent = useCreateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (e: CalendarEvent) => {
    setEditing(e);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add event
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (events ?? []).length === 0 ? (
        <EmptyState title="No events found" description="Add an event to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(events ?? []).map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: e.color || '#4f8ef7' }}
                  />
                  <h2 className="font-semibold text-gray-900">{e.title}</h2>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-primary" onClick={() => openEdit(e)}>
                    Edit
                  </button>
                  <button
                    className="text-sm text-danger"
                    onClick={() => {
                      if (confirm(`Delete ${e.title}?`)) deleteEvent.mutate(e.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="mt-1 text-sm text-muted">
                {e.start_date}
                {e.end_date ? ` → ${e.end_date}` : ''}
                {e.all_day ? ' (all day)' : ''}
              </p>
              {e.description && <p className="mt-2 text-sm text-gray-700">{e.description}</p>}
              {e.created_by && <p className="mt-2 text-xs text-muted">By {e.created_by}</p>}
            </div>
          ))}
        </div>
      )}

      <CalendarModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createEvent.isPending}
        onCreate={(data) => createEvent.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function CalendarModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: CalendarEvent | null;
  onClose: () => void;
  onCreate: (data: CalendarEventInput) => void;
  createSubmitting: boolean;
}) {
  const updateEvent = useUpdateCalendarEvent(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.title}` : 'Add event'}>
      <CalendarForm
        initial={editing ?? undefined}
        submitting={editing ? updateEvent.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateEvent.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

function CalendarForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: CalendarEvent;
  onSubmit: (data: CalendarEventInput) => void;
  submitting?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [color, setColor] = useState('#4f8ef7');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setTitle(initial?.title ?? '');
    setStartDate(initial?.start_date ?? '');
    setEndDate(initial?.end_date ?? '');
    setAllDay(initial?.all_day ?? true);
    setColor(initial?.color ?? '#4f8ef7');
    setDescription(initial?.description ?? '');
  }, [initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      startDate,
      endDate: endDate || undefined,
      allDay,
      color,
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
          className="input"
        />
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
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        All day
      </label>
      <Field label="Colour">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="input h-10 w-20 p-1"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
