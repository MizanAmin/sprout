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
import { Field, Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/gdpr')({
  component: GdprPage,
});

const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

const TABS = ['Settings', 'SAR', 'Erasure', 'Retention'] as const;
type Tab = (typeof TABS)[number];

function GdprPage() {
  const [tab, setTab] = useState<Tab>('Settings');
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">GDPR</h1>

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

      {tab === 'Settings' && <SettingsTab />}
      {tab === 'SAR' && <SarTab />}
      {tab === 'Erasure' && <ErasureTab />}
      {tab === 'Retention' && <RetentionTab />}
    </div>
  );
}

// ---- Settings tab ----

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

function SettingsTab() {
  const { data, isLoading } = useGdprSettings();
  if (isLoading) return <Spinner />;
  return <SettingsForm settings={data ?? null} />;
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
      onSubmit={handleSubmit((data) =>
        update.mutate(data, {
          onSuccess: () => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          },
        }),
      )}
      className="max-w-2xl space-y-4"
    >
      <Field label="Data controller" error={errors.dataController?.message}>
        <input {...register('dataController')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="DPO name" error={errors.dpoName?.message}>
          <input {...register('dpoName')} className="input" />
        </Field>
        <Field label="DPO email" error={errors.dpoEmail?.message}>
          <input {...register('dpoEmail')} className="input" />
        </Field>
      </div>
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
      <Field label="Lawful basis" error={errors.lawfulBasis?.message}>
        <input {...register('lawfulBasis')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Last audit date" error={errors.lastAuditDate?.message}>
          <input type="date" {...register('lastAuditDate')} className="input" />
        </Field>
        <Field label="Next audit date" error={errors.nextAuditDate?.message}>
          <input type="date" {...register('nextAuditDate')} className="input" />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-success">Saved.</span>}
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

const SAR_VARIANT: Record<SarStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  received: 'muted',
  in_progress: 'warning',
  completed: 'success',
  refused: 'danger',
};
const SAR_STATUSES: SarStatus[] = ['received', 'in_progress', 'completed', 'refused'];

// ---- SAR tab ----

function SarTab() {
  const { data, isLoading } = useSarRequests();
  const create = useCreateSar();
  const update = useUpdateSar();
  const remove = useDeleteSar();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="font-semibold text-gray-900">Subject access requests</h2>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          Add request
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState title="No SAR requests" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Requester</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Received</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{r.requester_name}</td>
                  <td className="px-4 py-2">{r.requester_email || '—'}</td>
                  <td className="px-4 py-2">{r.received_at}</td>
                  <td className="px-4 py-2">{r.due_date ?? '—'}</td>
                  <td className="px-4 py-2">
                    <select
                      className="input"
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
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Badge variant={SAR_VARIANT[r.status]}>{r.status.replace('_', ' ')}</Badge>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete SAR from ${r.requester_name}?`)) remove.mutate(r.id);
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

const ERASURE_VARIANT: Record<ErasureStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  pending: 'warning',
  completed: 'success',
  refused: 'danger',
};
const ERASURE_STATUSES: ErasureStatus[] = ['pending', 'completed', 'refused'];

// ---- Erasure tab ----

function ErasureTab() {
  const { data, isLoading } = useErasureRequests();
  const create = useCreateErasure();
  const update = useUpdateErasure();
  const remove = useDeleteErasure();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="font-semibold text-gray-900">Erasure requests</h2>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          Add request
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState title="No erasure requests" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Data subject</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Requested</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{r.data_subject}</td>
                  <td className="px-4 py-2">{r.email || '—'}</td>
                  <td className="px-4 py-2">{r.requested_at}</td>
                  <td className="px-4 py-2">{r.due_date ?? '—'}</td>
                  <td className="px-4 py-2">
                    <select
                      className="input"
                      value={r.status}
                      onChange={(e) =>
                        update.mutate({ id: r.id, data: { status: e.target.value as ErasureStatus } })
                      }
                    >
                      {ERASURE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Badge variant={ERASURE_VARIANT[r.status]}>{r.status}</Badge>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete erasure request for ${r.data_subject}?`)) remove.mutate(r.id);
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

// ---- Retention tab ----

function RetentionTab() {
  const { data, isLoading } = useRetentionPolicies();
  const create = useCreateRetention();
  const remove = useDeleteRetention();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="font-semibold text-gray-900">Retention policies</h2>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          Add policy
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState title="No retention policies" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Period (yrs)</th>
                <th className="px-4 py-2 font-medium">Legal basis</th>
                <th className="px-4 py-2 font-medium">Notes</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{p.data_category}</td>
                  <td className="px-4 py-2">{p.retention_period_years}</td>
                  <td className="px-4 py-2">{p.legal_basis || '—'}</td>
                  <td className="px-4 py-2">{p.notes || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-sm text-danger"
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
