import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { observationCreateSchema, type ObservationCreateInput } from '@sprout/schemas';
import { useChildren } from '../features/children/useChildren';
import {
  useObservations,
  useCreateObservation,
  useDeleteObservation,
} from '../features/observations/useObservations';
import { Field, Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/journal')({ component: JournalPage });

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const EYFS_AREAS = [
  'Communication and Language',
  'Physical Development',
  'Personal, Social and Emotional Development',
  'Literacy',
  'Mathematics',
  'Understanding the World',
  'Expressive Arts and Design',
];

function JournalPage() {
  const { data: children } = useChildren();
  const [childId, setChildId] = useState<number | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: observations, isLoading } = useObservations(childId ? { childId } : {});
  const createObs = useCreateObservation();
  const deleteObs = useDeleteObservation();

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Learning Journal</h1>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          Add observation
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="input max-w-xs"
          value={childId ?? ''}
          onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All children</option>
          {children?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !observations?.length ? (
        <EmptyState title="No observations" description="Add an observation to start the journal." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {observations.map((obs) => (
            <div key={obs.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900">{obs.child_name || '—'}</div>
                <span className="text-xs text-muted">{obs.obs_date}</span>
              </div>
              <p className="mt-2 text-sm text-gray-900">{obs.text}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {obs.areas?.map((a) => (
                  <Badge key={a} variant="info">
                    {a}
                  </Badge>
                ))}
                {obs.is_shared && <Badge variant="success">Shared</Badge>}
                {obs.score != null && <Badge variant="muted">Score {obs.score}/5</Badge>}
              </div>
              <div className="mt-3 text-right">
                <button
                  className="text-sm text-danger"
                  onClick={() => {
                    if (confirm('Delete this observation?')) deleteObs.mutate(obs.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddObservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultChildId={childId}
        submitting={createObs.isPending}
        onSubmit={(data) => createObs.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

function AddObservationModal({
  open,
  onClose,
  defaultChildId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  defaultChildId?: number;
  onSubmit: (data: ObservationCreateInput) => void;
  submitting?: boolean;
}) {
  const { data: children } = useChildren();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ObservationCreateInput>({
    resolver: zodResolver(observationCreateSchema),
    defaultValues: {
      childId: defaultChildId,
      obsDate: isoDate(new Date()),
      areas: [],
      isShared: false,
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Add observation">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Child" error={errors.childId?.message}>
            <select {...register('childId', { valueAsNumber: true })} className="input" defaultValue={defaultChildId ?? ''}>
              <option value="" disabled>
                Select…
              </option>
              {children?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date" error={errors.obsDate?.message}>
            <input type="date" {...register('obsDate')} className="input" />
          </Field>
        </div>

        <Field label="EYFS areas" error={errors.areas?.message}>
          <div className="space-y-1">
            {EYFS_AREAS.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" value={a} {...register('areas')} />
                {a}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Observation" error={errors.text?.message}>
          <textarea {...register('text')} className="input" rows={3} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Score (1–5)" error={errors.score?.message}>
            <input type="number" min={1} max={5} {...register('score', numberOpt)} className="input" />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isShared')} />
            Share with parents
          </label>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
