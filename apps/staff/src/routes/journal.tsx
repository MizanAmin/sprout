import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  observationCreateSchema,
  type ObservationCreateInput,
  type ObservationUpdateInput,
} from '@sprout/schemas';
import { useChildren } from '../features/children/useChildren';
import {
  useObservations,
  useCreateObservation,
  useUpdateObservation,
  useDeleteObservation,
  type Observation,
} from '../features/observations/useObservations';
import { Field, Modal, Badge, Spinner, EmptyState } from '../components/ui';
import { useUpload } from '../features/uploads/useUpload';
import { SignedImage } from '../components/SignedImage';

export const Route = createFileRoute('/journal')({ component: JournalPage });

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// EYFS 7 areas (full label) paired with short badge labels — mirrors the
// reference app's EYFS_AREAS / EYFS_SHORT.
const EYFS_AREAS = [
  'Communication and Language',
  'Physical Development',
  'Personal, Social and Emotional Development',
  'Literacy',
  'Mathematics',
  'Understanding the World',
  'Expressive Arts and Design',
] as const;

const EYFS_SHORT: Record<string, string> = {
  'Communication and Language': 'C&L',
  'Physical Development': 'PD',
  'Personal, Social and Emotional Development': 'PSED',
  Literacy: 'Lit',
  Mathematics: 'Maths',
  'Understanding the World': 'UW',
  'Expressive Arts and Design': 'EAD',
};

const shortArea = (a: string) => EYFS_SHORT[a] ?? a;

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function JournalPage() {
  const { data: children } = useChildren();
  const [childId, setChildId] = useState<number | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Observation | null>(null);

  const { data: observations, isLoading } = useObservations(childId ? { childId } : {});
  const createObs = useCreateObservation();
  const deleteObs = useDeleteObservation();

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (obs: Observation) => {
    setEditing(obs);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Learning Journal</h1>
        <button className="btn-primary" onClick={openAdd}>
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
        <EmptyState
          title="No observations yet"
          description="Add the first observation to start the learning journal."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {observations.map((obs) => (
            <ObservationCard
              key={obs.id}
              obs={obs}
              onEdit={() => openEdit(obs)}
              onDelete={() => {
                if (confirm('Delete this observation?')) deleteObs.mutate(obs.id);
              }}
            />
          ))}
        </div>
      )}

      <ObservationModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createObs.isPending}
        onCreate={(data) =>
          createObs.mutate(data, { onSuccess: () => setModalOpen(false) })
        }
      />
    </div>
  );
}

// ── Observation card ──────────────────────────────────────────────────────
function ObservationCard({
  obs,
  onEdit,
  onDelete,
}: {
  obs: Observation;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const areas = obs.areas ?? [];
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-info-light text-xs font-bold text-info">
            {initials(obs.child_name || '?')}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900">
              {obs.child_name || '—'}
            </div>
            <div className="text-xs text-muted">
              {obs.obs_date}
              {obs.practitioner ? ` · ${obs.practitioner}` : ''}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {obs.is_shared ? (
            <Badge variant="success">Shared</Badge>
          ) : (
            <Badge variant="warning">Draft</Badge>
          )}
        </div>
      </div>

      {/* Photo thumbnail if available — external URLs render directly, stored
          private-bucket paths resolve via a signed URL. */}
      {obs.photo_url ? (
        obs.photo_url.startsWith('http') ? (
          <img
            src={obs.photo_url}
            alt=""
            className="mt-3 h-40 w-full rounded-lg object-cover"
          />
        ) : (
          <SignedImage
            path={obs.photo_url}
            className="mt-3 h-40 w-full rounded-lg object-cover"
          />
        )
      ) : null}

      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-900">{obs.text}</p>

      {areas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {areas.map((a) => (
            <Badge key={a} variant="info">
              {shortArea(a)}
            </Badge>
          ))}
          {obs.score != null && <Badge variant="muted">Score {obs.score}/5</Badge>}
        </div>
      )}
      {areas.length === 0 && obs.score != null && (
        <div className="mt-3">
          <Badge variant="muted">Score {obs.score}/5</Badge>
        </div>
      )}

      {obs.next_steps ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
          ⭐ Next step: {obs.next_steps}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end gap-3">
        <button className="text-sm text-primary" onClick={onEdit}>
          Edit
        </button>
        <button className="text-sm text-danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

const numberOpt = {
  setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)),
};

// ── Add / edit modal ──────────────────────────────────────────────────────
function ObservationModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Observation | null;
  onClose: () => void;
  onCreate: (data: ObservationCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateObs = useUpdateObservation(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit observation' : 'New observation'}
    >
      <ObservationForm
        // Remount when the target observation changes so defaults reset.
        key={editing?.id ?? 'new'}
        editing={editing}
        submitting={editing ? updateObs.isPending : createSubmitting}
        onSubmit={(data) =>
          editing
            ? updateObs.mutate(data as ObservationUpdateInput, { onSuccess: onClose })
            : onCreate(data)
        }
      />
    </Modal>
  );
}

function ObservationForm({
  editing,
  onSubmit,
  submitting,
}: {
  editing: Observation | null;
  onSubmit: (data: ObservationCreateInput) => void;
  submitting?: boolean;
}) {
  const { data: children } = useChildren();
  const upload = useUpload();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ObservationCreateInput>({
    resolver: zodResolver(observationCreateSchema),
    defaultValues: {
      childId: editing?.child_id,
      obsDate: editing?.obs_date ?? isoDate(new Date()),
      areas: editing?.areas ?? [],
      text: editing?.text ?? '',
      photoUrl: editing?.photo_url ?? '',
      practitioner: editing?.practitioner ?? '',
      score: editing?.score ?? undefined,
      nextSteps: editing?.next_steps ?? '',
      isShared: editing?.is_shared ?? false,
    },
  });

  const watchedPhotoUrl = watch('photoUrl');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Child" error={errors.childId?.message}>
          <select
            {...register('childId', { valueAsNumber: true })}
            className="input"
            defaultValue={editing?.child_id ?? ''}
          >
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

      {/* EYFS area tags — selectable badges backed by a string[] field. */}
      <Field label="EYFS areas" error={errors.areas?.message}>
        <Controller
          control={control}
          name="areas"
          render={({ field }) => {
            const selected = field.value ?? [];
            const toggle = (area: string) =>
              field.onChange(
                selected.includes(area)
                  ? selected.filter((a) => a !== area)
                  : [...selected, area],
              );
            return (
              <div className="flex flex-wrap gap-2">
                {EYFS_AREAS.map((area) => {
                  const isSel = selected.includes(area);
                  return (
                    <button
                      type="button"
                      key={area}
                      onClick={() => toggle(area)}
                      title={area}
                      className={
                        isSel
                          ? 'badge badge-info cursor-pointer'
                          : 'cursor-pointer rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted'
                      }
                    >
                      {shortArea(area)}
                    </button>
                  );
                })}
              </div>
            );
          }}
        />
      </Field>

      <Field label="Observation" error={errors.text?.message}>
        <textarea {...register('text')} className="input" rows={4} />
      </Field>

      <Field label="Photo" error={errors.photoUrl?.message}>
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            className="input"
            disabled={upload.isPending}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const { path } = await upload.mutateAsync({ file, kind: 'observation' });
              setValue('photoUrl', path, { shouldDirty: true });
            }}
          />
          {upload.isPending && <p className="text-xs text-muted">Uploading…</p>}
          {watchedPhotoUrl && !watchedPhotoUrl.startsWith('http') ? (
            <SignedImage
              path={watchedPhotoUrl}
              className="h-24 w-24 rounded-lg object-cover"
            />
          ) : null}
          {/* Manual URL fallback for externally hosted images. */}
          <input
            type="url"
            {...register('photoUrl')}
            className="input"
            placeholder="…or paste an image URL"
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Practitioner" error={errors.practitioner?.message}>
          <input {...register('practitioner')} className="input" />
        </Field>
        <Field label="Score (1–5)" error={errors.score?.message}>
          <input
            type="number"
            min={1}
            max={5}
            {...register('score', numberOpt)}
            className="input"
          />
        </Field>
      </div>

      <Field label="Next steps" error={errors.nextSteps?.message}>
        <textarea {...register('nextSteps')} className="input" rows={3} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('isShared')} />
        Share with parents
      </label>

      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
