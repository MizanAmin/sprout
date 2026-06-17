import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sessionCreateSchema, type SessionCreateInput } from '@sprout/schemas';
import { api } from '../../api';
import { useChild, useUpdateChild } from '../../features/children/useChildren';
import { ChildForm } from '../../features/children/ChildForm';
import { Field, Badge, Spinner, EmptyState, Breadcrumb } from '../../components/ui';

export const Route = createFileRoute('/children/$childId')({ component: ChildDetailPage });

const TABS = ['Profile', 'Documents', 'Sessions', 'Observations', 'Assessments', 'SEND'] as const;
type Tab = (typeof TABS)[number];

function ChildDetailPage() {
  const { childId } = Route.useParams();
  const id = Number(childId);
  const { data: child, isLoading } = useChild(id);
  const [tab, setTab] = useState<Tab>('Profile');

  if (isLoading) return <Spinner />;
  if (!child) return <EmptyState title="Child not found" />;

  return (
    <div className="space-y-4 p-6">
      <Breadcrumb items={[{ label: 'Children', to: '/children' }, { label: child.name }]} />
      <h1 className="text-2xl font-semibold text-gray-900">{child.name}</h1>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm ${
              tab === t
                ? 'border-b-2 border-primary font-medium text-primary'
                : 'text-muted hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Profile' && <ProfileTab id={id} />}
      {tab === 'Documents' && <DocumentsTab id={id} />}
      {tab === 'Sessions' && <SessionsTab id={id} />}
      {tab === 'Observations' && <ObservationsTab id={id} />}
      {tab === 'Assessments' && <AssessmentsTab id={id} />}
      {tab === 'SEND' && <SendTab id={id} />}
    </div>
  );
}

function ProfileTab({ id }: { id: number }) {
  const { data: child } = useChild(id);
  const update = useUpdateChild(id);
  const [saved, setSaved] = useState(false);
  if (!child) return null;
  return (
    <div className="max-w-2xl">
      {saved && <p className="mb-3 text-sm text-success">Saved.</p>}
      <ChildForm
        initial={child}
        submitting={update.isPending}
        onSubmit={(data) =>
          update.mutate(data, {
            onSuccess: () => {
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            },
          })
        }
      />
    </div>
  );
}

// ---- Sessions (full CRUD) ----

interface ChildSession {
  id: number;
  day: string;
  session_type: string;
  start_time: string | null;
  end_time: string | null;
  funded_hours: number;
  fee_hours: number;
  room: string;
  start_date: string;
  end_date: string | null;
}

const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

function SessionsTab({ id }: { id: number }) {
  const qc = useQueryClient();
  const key = ['child-sessions', id];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<ChildSession[]>(`/child-sessions?childId=${id}`),
  });
  const create = useMutation({
    mutationFn: (body: SessionCreateInput) => api.post('/child-sessions', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: (sid: number) => api.delete(`/child-sessions/${sid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="font-semibold text-gray-900">Weekly sessions</h2>
        <button className="text-sm text-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : '+ Add session'}
        </button>
      </div>

      {adding && (
        <SessionForm
          childId={id}
          submitting={create.isPending}
          onSubmit={(d) => create.mutate(d, { onSuccess: () => setAdding(false) })}
        />
      )}

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState title="No sessions yet" />
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2">Day</th>
              <th>Type</th>
              <th>Fee hrs</th>
              <th>Funded hrs</th>
              <th>From</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((s) => (
              <tr key={s.id}>
                <td className="py-2">{s.day}</td>
                <td>{s.session_type}</td>
                <td>{s.fee_hours}</td>
                <td>{s.funded_hours}</td>
                <td>{s.start_date}</td>
                <td className="text-right">
                  <button className="text-danger" onClick={() => remove.mutate(s.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SessionForm({
  childId,
  onSubmit,
  submitting,
}: {
  childId: number;
  onSubmit: (d: SessionCreateInput) => void;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SessionCreateInput>({
    resolver: zodResolver(sessionCreateSchema),
    defaultValues: { childId, day: 'Mon', sessionType: 'Full Day', fundedHours: 0, feeHours: 0, startDate: '' },
  });
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <input type="hidden" {...register('childId', { valueAsNumber: true })} />
      <Field label="Day" error={errors.day?.message}>
        <select {...register('day')} className="input">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Field>
      <Field label="Type" error={errors.sessionType?.message}>
        <select {...register('sessionType')} className="input">
          {['AM', 'PM', 'Full Day', 'Custom'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Fee hours" error={errors.feeHours?.message}>
        <input type="number" step="0.5" {...register('feeHours', numberOpt)} className="input" />
      </Field>
      <Field label="Funded hours" error={errors.fundedHours?.message}>
        <input type="number" step="0.5" {...register('fundedHours', numberOpt)} className="input" />
      </Field>
      <Field label="Start time" error={errors.startTime?.message}>
        <input type="time" {...register('startTime')} className="input" />
      </Field>
      <Field label="End time" error={errors.endTime?.message}>
        <input type="time" {...register('endTime')} className="input" />
      </Field>
      <Field label="Start date" error={errors.startDate?.message}>
        <input type="date" {...register('startDate')} className="input" />
      </Field>
      <Field label="End date" error={errors.endDate?.message}>
        <input type="date" {...register('endDate')} className="input" />
      </Field>
      <div className="col-span-2 flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add session'}
        </button>
      </div>
    </form>
  );
}

// ---- Read-only tabs ----

function DocumentsTab({ id }: { id: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['child-documents', id],
    queryFn: () =>
      api.get<{ id: number; name: string; file_type: string; uploaded_by: string }[]>(
        `/child-documents?childId=${id}`,
      ),
  });
  if (isLoading) return <Spinner />;
  if (!data?.length) return <EmptyState title="No documents" />;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {data.map((d) => (
        <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
          <span>{d.name}</span>
          <span className="text-muted">{d.file_type || '—'}</span>
        </li>
      ))}
    </ul>
  );
}

function ObservationsTab({ id }: { id: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['observations', id],
    queryFn: () =>
      api.get<{ id: number; obs_date: string; text: string; areas: string[]; is_shared: boolean }[]>(
        `/observations?childId=${id}`,
      ),
  });
  if (isLoading) return <Spinner />;
  if (!data?.length) return <EmptyState title="No observations" />;
  return (
    <div className="space-y-3">
      {data.map((o) => (
        <div key={o.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <span>{o.obs_date}</span>
            {o.is_shared && <Badge variant="info">Shared</Badge>}
          </div>
          <p className="text-sm text-gray-900">{o.text}</p>
          {o.areas?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {o.areas.map((a) => (
                <Badge key={a} variant="muted">
                  {a}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AssessmentsTab({ id }: { id: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['assessments', id],
    queryFn: () =>
      api.get<{ id: number; area: string; score: number; assessed_at: string }[]>(
        `/assessments?childId=${id}`,
      ),
  });
  if (isLoading) return <Spinner />;
  if (!data?.length) return <EmptyState title="No assessments" />;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-muted">
        <tr>
          <th className="py-2">Area</th>
          <th>Score</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((a) => (
          <tr key={a.id}>
            <td className="py-2">{a.area}</td>
            <td>{a.score}/5</td>
            <td>{a.assessed_at}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SendTab({ id }: { id: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['send', id],
    queryFn: () =>
      api.get<{ id: number; category: string; details: string; review_date: string | null }[]>(
        `/send?childId=${id}`,
      ),
  });
  if (isLoading) return <Spinner />;
  if (!data?.length) return <EmptyState title="No SEND flags" />;
  return (
    <div className="space-y-3">
      {data.map((f) => (
        <div key={f.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <Badge variant="warning">{f.category}</Badge>
            {f.review_date && <span className="text-xs text-muted">Review {f.review_date}</span>}
          </div>
          {f.details && <p className="mt-2 text-sm text-gray-900">{f.details}</p>}
        </div>
      ))}
    </div>
  );
}
