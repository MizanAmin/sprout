import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useGdprSettings,
  useUpdateGdprSettings,
  gdprSettingsSchema,
  type GdprSettings,
  type GdprSettingsInput,
  useSarRequests,
  useCreateSar,
  useUpdateSar,
  useDeleteSar,
  sarCreateSchema,
  type SarCreateInput,
  type SarStatus,
  useErasureRequests,
  useCreateErasure,
  useUpdateErasure,
  useDeleteErasure,
  erasureCreateSchema,
  type ErasureCreateInput,
  type ErasureStatus,
  useRetentionPolicies,
  useCreateRetention,
  useDeleteRetention,
  retentionCreateSchema,
  type RetentionCreateInput,
} from '../features/gdpr/useGdpr';
import { Field, Modal, Badge, Spinner, EmptyState, StatCard } from '../components/ui';

export const Route = createFileRoute('/gdpr')({
  component: GdprPage,
});

const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

const SAR_VARIANT: Record<SarStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  received: 'muted',
  in_progress: 'warning',
  completed: 'success',
  refused: 'danger',
};
const SAR_STATUSES: SarStatus[] = ['received', 'in_progress', 'completed', 'refused'];

const ERASURE_VARIANT: Record<ErasureStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  pending: 'warning',
  completed: 'success',
  refused: 'danger',
};
const ERASURE_STATUSES: ErasureStatus[] = ['pending', 'completed', 'refused'];

function GdprPage() {
  const settings = useGdprSettings();
  const sars = useSarRequests();
  const erasures = useErasureRequests();
  const retention = useRetentionPolicies();

  const openSars = sars.data?.filter(
    (s) => s.status !== 'completed' && s.status !== 'refused',
  ).length;
  const openErasures = erasures.data?.filter(
    (e) => e.status !== 'completed' && e.status !== 'refused',
  ).length;

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">GDPR</h1>

      {/* Header status cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Data controller"
          value={settings.data?.data_controller ? 'Configured' : 'Not set'}
          hint={settings.data?.data_controller || 'Set ICO / DPO details below'}
        />
        <StatCard
          label="SAR requests"
          value={sars.data?.length ?? 0}
          hint={openSars ? `${openSars} open` : 'None open'}
        />
        <StatCard
          label="Erasure requests"
          value={erasures.data?.length ?? 0}
          hint={openErasures ? `${openErasures} open` : 'None open'}
        />
        <StatCard label="Retention policies" value={retention.data?.length ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: Settings + SAR */}
        <div className="space-y-4">
          <SettingsCard query={settings} />
          <SarCard />
        </div>

        {/* RIGHT: Erasure + Retention */}
        <div className="space-y-4">
          <ErasureCard />
          <RetentionCard />
        </div>
      </div>
    </div>
  );
}

// ---- ICO & DPO settings ----

function toSettingsValues(s: GdprSettings | null): GdprSettingsInput {
  if (!s) return {};
  return {
    dataController: s.data_controller,
    dpoName: s.dpo_name,
    dpoEmail: s.dpo_email,
    retentionChildren: s.retention_children,
    retentionStaff: s.retention_staff,
    retentionCctv: s.retention_cctv,
    lawfulBasis: s.lawful_basis,
    lastAuditDate: s.last_audit_date ?? undefined,
    nextAuditDate: s.next_audit_date ?? undefined,
  };
}

function SettingsCard({ query }: { query: ReturnType<typeof useGdprSettings> }) {
  const { data, isLoading } = query;
  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-gray-900">ICO &amp; DPO details</h2>
      {isLoading ? <Spinner /> : <SettingsForm settings={data ?? null} />}
      {/* TODO: needs ico_registered / ico_number / privacy_notice fields — not in
          the /gdpr/settings shape (useGdpr GdprSettings). Add columns + schema
          fields to surface the "Registered with the ICO" toggle and the privacy
          notice textarea from the reference. */}
    </div>
  );
}

function SettingsForm({ settings }: { settings: GdprSettings | null }) {
  const update = useUpdateGdprSettings();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GdprSettingsInput>({
    resolver: zodResolver(gdprSettingsSchema),
    defaultValues: toSettingsValues(settings),
  });

  return (
    <form
      onSubmit={handleSubmit((d) =>
        update.mutate(d, {
          onSuccess: () => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          },
        }),
      )}
      className="space-y-4"
    >
      <Field label="Data controller" error={errors.dataController?.message}>
        <input
          {...register('dataController')}
          className="input"
          placeholder="e.g. Your Nursery Ltd"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="DPO name" error={errors.dpoName?.message}>
          <input {...register('dpoName')} className="input" placeholder="Nursery Manager" />
        </Field>
        <Field label="DPO email" error={errors.dpoEmail?.message}>
          <input {...register('dpoEmail')} className="input" placeholder="dpo@nursery.co.uk" />
        </Field>
      </div>
      <Field label="Lawful basis" error={errors.lawfulBasis?.message}>
        <input {...register('lawfulBasis')} className="input" placeholder="contract" />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Retention — children (yrs)" error={errors.retentionChildren?.message}>
          <input type="number" {...register('retentionChildren', numberOpt)} className="input" />
        </Field>
        <Field label="Retention — staff (yrs)" error={errors.retentionStaff?.message}>
          <input type="number" {...register('retentionStaff', numberOpt)} className="input" />
        </Field>
        <Field label="Retention — CCTV (days)" error={errors.retentionCctv?.message}>
          <input type="number" {...register('retentionCctv', numberOpt)} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Last audit date" error={errors.lastAuditDate?.message}>
          <input type="date" {...register('lastAuditDate')} className="input" />
        </Field>
        <Field label="Next audit date" error={errors.nextAuditDate?.message}>
          <input type="date" {...register('nextAuditDate')} className="input" />
        </Field>
      </div>
      <div className="rounded-lg border border-warning/40 bg-warning-light px-3.5 py-2.5 text-xs text-warning">
        Most nurseries must register with the ICO.{' '}
        <a
          href="https://ico.org.uk/for-organisations/register/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline"
        >
          Register here
        </a>{' '}
        — costs around £40–£60/year.
      </div>
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-success">Saved.</span>}
        <button type="submit" className="btn-primary btn-sm" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

// ---- Subject Access Requests ----

function SarCard() {
  const { data, isLoading } = useSarRequests();
  const create = useCreateSar();
  const update = useUpdateSar();
  const remove = useDeleteSar();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Subject access requests</h2>
        <button className="btn-primary btn-sm" onClick={() => setModalOpen(true)}>
          Add request
        </button>
      </div>
      <p className="text-xs text-muted">
        Export all data held on a subject. Must be fulfilled within 30 days of request.
      </p>

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState
          title="No SAR requests"
          description="Logged subject access requests appear here."
        />
      ) : (
        <div className="space-y-2">
          {data.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900">{r.requester_name}</div>
                <div className="truncate text-xs text-muted">
                  {r.requester_email || '—'} · received {r.received_at}
                  {r.due_date ? ` · due ${r.due_date}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  className="input !w-auto !py-1 text-xs"
                  value={r.status}
                  onChange={(e) =>
                    update.mutate({ id: r.id, data: { status: e.target.value as SarStatus } })
                  }
                >
                  {SAR_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <Badge variant={SAR_VARIANT[r.status]}>{r.status.replace('_', ' ')}</Badge>
                <button
                  className="text-xs font-medium text-danger"
                  onClick={() => {
                    if (confirm(`Delete SAR from ${r.requester_name}?`)) remove.mutate(r.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add SAR request">
        <SarForm
          submitting={create.isPending}
          onSubmit={(d) => create.mutate(d, { onSuccess: () => setModalOpen(false) })}
        />
      </Modal>
    </div>
  );
}

function SarForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (d: SarCreateInput) => void;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SarCreateInput>({
    resolver: zodResolver(sarCreateSchema),
    defaultValues: { status: 'received' },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Requester name" error={errors.requesterName?.message}>
        <input {...register('requesterName')} className="input" />
      </Field>
      <Field label="Requester email" error={errors.requesterEmail?.message}>
        <input {...register('requesterEmail')} className="input" />
      </Field>
      <Field label="Subject" error={errors.subject?.message}>
        <input {...register('subject')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Received at" error={errors.receivedAt?.message}>
          <input type="date" {...register('receivedAt')} className="input" />
        </Field>
        <Field label="Due date" error={errors.dueDate?.message}>
          <input type="date" {...register('dueDate')} className="input" />
        </Field>
      </div>
      <Field label="Status" error={errors.status?.message}>
        <select {...register('status')} className="input">
          {SAR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes" error={errors.notes?.message}>
        <textarea {...register('notes')} className="input" rows={2} />
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add request'}
        </button>
      </div>
    </form>
  );
}

// ---- Right to Erasure ----

function ErasureCard() {
  const { data, isLoading } = useErasureRequests();
  const create = useCreateErasure();
  const update = useUpdateErasure();
  const remove = useDeleteErasure();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Right to erasure</h2>
        <button className="btn-primary btn-sm" onClick={() => setModalOpen(true)}>
          Add request
        </button>
      </div>
      <p className="text-xs text-muted">
        Anonymises personal data for a subject. Financial records are retained for legal compliance
        (HMRC 7 years).
      </p>

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState title="No erasure requests" description="Logged erasure requests appear here." />
      ) : (
        <div className="space-y-2">
          {data.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900">{r.data_subject}</div>
                <div className="truncate text-xs text-muted">
                  {r.email || '—'} · requested {r.requested_at}
                  {r.due_date ? ` · due ${r.due_date}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  className="input !w-auto !py-1 text-xs"
                  value={r.status}
                  onChange={(e) =>
                    update.mutate({
                      id: r.id,
                      data: { status: e.target.value as ErasureStatus },
                    })
                  }
                >
                  {ERASURE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Badge variant={ERASURE_VARIANT[r.status]}>{r.status}</Badge>
                <button
                  className="text-xs font-medium text-danger"
                  onClick={() => {
                    if (confirm(`Delete erasure request for ${r.data_subject}?`))
                      remove.mutate(r.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add erasure request">
        <ErasureForm
          submitting={create.isPending}
          onSubmit={(d) => create.mutate(d, { onSuccess: () => setModalOpen(false) })}
        />
      </Modal>
    </div>
  );
}

function ErasureForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (d: ErasureCreateInput) => void;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ErasureCreateInput>({
    resolver: zodResolver(erasureCreateSchema),
    defaultValues: { status: 'pending' },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Data subject" error={errors.dataSubject?.message}>
        <input {...register('dataSubject')} className="input" />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <input {...register('email')} className="input" />
      </Field>
      <Field label="Reason" error={errors.reason?.message}>
        <textarea {...register('reason')} className="input" rows={2} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Requested at" error={errors.requestedAt?.message}>
          <input type="date" {...register('requestedAt')} className="input" />
        </Field>
        <Field label="Due date" error={errors.dueDate?.message}>
          <input type="date" {...register('dueDate')} className="input" />
        </Field>
      </div>
      <Field label="Status" error={errors.status?.message}>
        <select {...register('status')} className="input">
          {ERASURE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes" error={errors.notes?.message}>
        <textarea {...register('notes')} className="input" rows={2} />
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add request'}
        </button>
      </div>
    </form>
  );
}

// ---- Data retention periods ----

function RetentionCard() {
  const { data, isLoading } = useRetentionPolicies();
  const create = useCreateRetention();
  const remove = useDeleteRetention();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Data retention periods</h2>
        <button className="btn-primary btn-sm" onClick={() => setModalOpen(true)}>
          Add policy
        </button>
      </div>
      <p className="text-xs text-muted">
        UK GDPR requires you keep data only as long as necessary.
      </p>

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState
          title="No retention policies"
          description="Add a policy to define how long each data category is kept."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Data type</th>
                <th className="px-3 py-2 font-medium">Years</th>
                <th className="px-3 py-2 font-medium">Legal basis</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{p.data_category}</td>
                  <td className="px-3 py-2 font-semibold">{p.retention_period_years}y</td>
                  <td className="px-3 py-2 text-muted">{p.legal_basis || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {/* TODO: needs an edit modal wired to useUpdateRetention (PATCH
                        /gdpr/retention/:id exists). Reference allows inline editing
                        of years + legal basis on row click. */}
                    <button
                      className="text-xs font-medium text-danger"
                      onClick={() => {
                        if (confirm(`Delete policy "${p.data_category}"?`)) remove.mutate(p.id);
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

      {/* TODO: needs /gdpr/audit endpoint — reference shows an Audit Log card
          (recent data access / SAR_EXPORT / ERASURE entries). Not exposed by
          useGdpr or apps/api/src/routes/gdpr.ts. */}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add retention policy">
        <RetentionForm
          submitting={create.isPending}
          onSubmit={(d) => create.mutate(d, { onSuccess: () => setModalOpen(false) })}
        />
      </Modal>
    </div>
  );
}

function RetentionForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (d: RetentionCreateInput) => void;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RetentionCreateInput>({
    resolver: zodResolver(retentionCreateSchema),
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Data category" error={errors.dataCategory?.message}>
        <input {...register('dataCategory')} className="input" />
      </Field>
      <Field label="Retention period (years)" error={errors.retentionPeriodYears?.message}>
        <input type="number" {...register('retentionPeriodYears', numberOpt)} className="input" />
      </Field>
      <Field label="Legal basis" error={errors.legalBasis?.message}>
        <input {...register('legalBasis')} className="input" />
      </Field>
      <Field label="Notes" error={errors.notes?.message}>
        <textarea {...register('notes')} className="input" rows={2} />
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add policy'}
        </button>
      </div>
    </form>
  );
}
