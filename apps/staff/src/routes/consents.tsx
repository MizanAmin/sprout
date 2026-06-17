import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  consentTemplateCreateSchema,
  type ConsentTemplateCreateInput,
  consentFormCreateSchema,
  type ConsentFormCreateInput,
} from '@sprout/schemas';
import {
  useConsentTemplates,
  useCreateConsentTemplate,
  useUpdateConsentTemplate,
  useDeleteConsentTemplate,
  useConsentForms,
  useCreateConsentForm,
  useUpdateConsentFormStatus,
  useDeleteConsentForm,
  type ConsentTemplate,
  type ConsentForm,
  type ConsentFormStatus,
} from '../features/consents/useConsents';
import { useChildren } from '../features/children/useChildren';
import { Field, Modal, Badge, Spinner, EmptyState, StatCard } from '../components/ui';

export const Route = createFileRoute('/consents')({
  component: ConsentsPage,
});

const FORM_STATUS_VARIANT: Record<ConsentFormStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  signed: 'success',
  declined: 'danger',
};

const ukDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('en-GB') : '—';
const ukDateTime = (s: string | null) =>
  s
    ? new Date(s).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

function ConsentsPage() {
  const { data: templates, isLoading: templatesLoading } = useConsentTemplates();

  // Status filter applied to the sent-forms list (mirrors the reference filter).
  const [statusFilter, setStatusFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const { data: forms, isLoading: formsLoading } = useConsentForms(
    statusFilter ? { status: statusFilter } : {},
  );

  // Template add/edit modal state.
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  // "Issue form" modal, optionally pre-seeded with a template (the reference's Send).
  const [issueTemplateId, setIssueTemplateId] = useState<number | null>(null);
  const [issueModalOpen, setIssueModalOpen] = useState(false);

  const deleteTemplate = useDeleteConsentTemplate();

  // KPI counts. The reference also shows "overdue", but Sprout's consent_forms
  // has no due_date column, so that card is omitted.
  // TODO: needs a due_date column on consent_forms to compute overdue counts.
  const counts = useMemo(() => {
    const all = forms ?? [];
    return {
      pending: all.filter((f) => f.status === 'pending').length,
      signed: all.filter((f) => f.status === 'signed').length,
      declined: all.filter((f) => f.status === 'declined').length,
    };
  }, [forms]);

  // Template-filter is client-side (the forms endpoint only filters by status).
  const visibleForms = useMemo(() => {
    const all = forms ?? [];
    if (!templateFilter) return all;
    return all.filter((f) => String(f.template_id ?? '') === templateFilter);
  }, [forms, templateFilter]);

  const openAddTemplate = () => {
    setEditing(null);
    setTemplateModalOpen(true);
  };
  const openEditTemplate = (t: ConsentTemplate) => {
    setEditing(t);
    setTemplateModalOpen(true);
  };
  const openSend = (templateId: number) => {
    setIssueTemplateId(templateId);
    setIssueModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Consent Forms</h1>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Awaiting signature" value={counts.pending} />
        <StatCard label="Signed" value={counts.signed} />
        <StatCard label="Declined" value={counts.declined} />
        <StatCard label="Templates" value={(templates ?? []).length} />
      </div>

      {/* Form templates */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Form Templates</h2>
          <button className="btn-primary" onClick={openAddTemplate}>
            New template
          </button>
        </div>

        {templatesLoading ? (
          <Spinner />
        ) : (templates ?? []).length === 0 ? (
          <EmptyState
            title="No templates yet"
            description="Create one to start issuing consent forms."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(templates ?? []).map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => openEditTemplate(t)}
                onSend={() => openSend(t.id)}
                onDelete={() => {
                  if (confirm(`Delete template "${t.title}"?`)) deleteTemplate.mutate(t.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sent forms tracking */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Sent Forms</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="input max-w-[10rem]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="signed">Signed</option>
              <option value="declined">Declined</option>
            </select>
            <select
              className="input max-w-[12rem]"
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
            >
              <option value="">All forms</option>
              {(templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formsLoading ? (
          <Spinner />
        ) : visibleForms.length === 0 ? (
          <EmptyState
            title="No forms sent yet"
            description="Use a template above and click Send to issue a form."
          />
        ) : (
          <SentFormsTable forms={visibleForms} />
        )}
      </div>

      <TemplateModal
        open={templateModalOpen}
        editing={editing}
        onClose={() => setTemplateModalOpen(false)}
      />
      <IssueFormModal
        open={issueModalOpen}
        defaultTemplateId={issueTemplateId}
        onClose={() => setIssueModalOpen(false)}
      />
    </div>
  );
}

// --- Template card ---

function TemplateCard({
  template: t,
  onEdit,
  onSend,
  onDelete,
}: {
  template: ConsentTemplate;
  onEdit: () => void;
  onSend: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-gray-900">{t.title}</div>
          <p className="mt-1 line-clamp-3 text-xs text-muted">{t.body}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={t.active ? 'success' : 'muted'}>
              {t.active ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="info">v{t.version}</Badge>
            {/* The reference shows a "Requires signature" / category badge, but
                Sprout's consent_templates has only title/body/version/active.
                TODO: needs requires_signature + category columns on consent_templates. */}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
        <button className="btn-outline btn-sm" onClick={onEdit}>
          Edit
        </button>
        <button className="btn-outline btn-sm text-success" onClick={onSend}>
          Send
        </button>
        <button className="btn-outline btn-sm text-danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

// --- Sent forms table ---

function SentFormsTable({ forms }: { forms: ConsentForm[] }) {
  const updateStatus = useUpdateConsentFormStatus();
  const deleteForm = useDeleteConsentForm();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Child</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Signed by</th>
            <th className="px-4 py-2 font-medium">Signed at</th>
            <th className="px-4 py-2 font-medium">Issued</th>
            <th className="px-4 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {forms.map((f) => (
            <tr key={f.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-medium text-gray-900">{f.child_name || '—'}</td>
              <td className="px-4 py-2">
                <Badge variant={FORM_STATUS_VARIANT[f.status]}>{f.status}</Badge>
              </td>
              <td className="px-4 py-2">{f.signed_by || '—'}</td>
              <td className="px-4 py-2 text-muted">{ukDateTime(f.signed_at)}</td>
              <td className="px-4 py-2 text-muted">{ukDate(f.created_at)}</td>
              <td className="px-4 py-2 text-right">
                {f.status !== 'signed' && (
                  <button
                    className="text-sm text-success"
                    onClick={() => updateStatus.mutate({ id: f.id, status: 'signed' })}
                  >
                    Mark signed
                  </button>
                )}
                {f.status !== 'declined' && (
                  <button
                    className="ml-3 text-sm text-warning"
                    onClick={() => updateStatus.mutate({ id: f.id, status: 'declined' })}
                  >
                    Mark declined
                  </button>
                )}
                <button
                  className="ml-3 text-sm text-danger"
                  onClick={() => {
                    if (confirm(`Delete consent form for ${f.child_name || 'this child'}?`))
                      deleteForm.mutate(f.id);
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
  );
}

// --- Template add/edit modal ---

function TemplateModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: ConsentTemplate | null;
  onClose: () => void;
}) {
  const createTemplate = useCreateConsentTemplate();
  const updateTemplate = useUpdateConsentTemplate(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.title}` : 'New template'}>
      <TemplateForm
        key={editing?.id ?? 'new'}
        initial={editing ?? undefined}
        submitting={editing ? updateTemplate.isPending : createTemplate.isPending}
        onSubmit={(data) =>
          editing
            ? updateTemplate.mutate(data, { onSuccess: onClose })
            : createTemplate.mutate(data, { onSuccess: onClose })
        }
      />
    </Modal>
  );
}

function TemplateForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: ConsentTemplate;
  onSubmit: (data: ConsentTemplateCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsentTemplateCreateInput>({
    resolver: zodResolver(consentTemplateCreateSchema),
    defaultValues: initial
      ? { title: initial.title, body: initial.body, version: initial.version, active: initial.active }
      : { active: true },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Form title" error={errors.title?.message}>
        <input
          {...register('title')}
          className="input"
          placeholder="e.g. Photo & Video Permission"
        />
      </Field>
      <Field label="Version" error={errors.version?.message}>
        <input {...register('version')} placeholder="1.0" className="input" />
      </Field>
      <Field label="Form body" error={errors.body?.message}>
        <textarea
          {...register('body')}
          className="input"
          rows={6}
          placeholder="Full text of the consent form parents will read before signing."
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('active')} />
        Active
      </label>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

// --- Issue / send form modal ---

// Empty string → undefined so optional numeric selects don't become NaN.
const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

function IssueFormModal({
  open,
  defaultTemplateId,
  onClose,
}: {
  open: boolean;
  defaultTemplateId: number | null;
  onClose: () => void;
}) {
  const { data: templates } = useConsentTemplates();
  const { data: children } = useChildren();
  const createForm = useCreateConsentForm();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsentFormCreateInput>({
    resolver: zodResolver(consentFormCreateSchema),
    // Re-seed defaults when the modal is opened for a specific template.
    defaultValues: { status: 'pending', templateId: defaultTemplateId ?? undefined },
  });

  // The reference "Send" lets a manager pick many children at once; Sprout's
  // POST /consents creates one form per call, so this issues a single form.
  // TODO: needs a bulk send endpoint (POST /consents/templates/:id/send) to
  // issue a form to multiple children in one action.
  return (
    <Modal
      // key forces the form to reset its defaults each time a different template
      // is selected for sending.
      key={defaultTemplateId ?? 'none'}
      open={open}
      onClose={onClose}
      title="Issue consent form"
    >
      <form
        onSubmit={handleSubmit((data) =>
          createForm.mutate(data, { onSuccess: onClose }),
        )}
        className="space-y-4"
      >
        <Field label="Template" error={errors.templateId?.message}>
          <select
            {...register('templateId', numberOpt)}
            className="input"
            defaultValue={defaultTemplateId ?? ''}
          >
            <option value="">Select…</option>
            {templates?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} (v{t.version})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Child" error={errors.childId?.message}>
          <select {...register('childId', numberOpt)} className="input" defaultValue="">
            <option value="">Select…</option>
            {children?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Child name (optional override)" error={errors.childName?.message}>
          <input {...register('childName')} className="input" />
        </Field>
        <Field label="Status" error={errors.status?.message}>
          <select {...register('status')} className="input">
            <option value="pending">Pending</option>
            <option value="signed">Signed</option>
            <option value="declined">Declined</option>
          </select>
        </Field>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={createForm.isPending}>
            {createForm.isPending ? 'Issuing…' : 'Issue form'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
