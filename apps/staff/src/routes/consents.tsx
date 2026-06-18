import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  consentTemplateCreateSchema,
  type ConsentTemplateCreateInput,
} from '@sprout/schemas';
import {
  useConsentTemplates,
  useCreateConsentTemplate,
  useUpdateConsentTemplate,
  useDeleteConsentTemplate,
  useConsentForms,
  useBulkSend,
  useUpdateConsentFormStatus,
  useDeleteConsentForm,
  type ConsentTemplate,
  type ConsentForm,
  type ConsentFormStatus,
} from '../features/consents/useConsents';
import { useChildren } from '../features/children/useChildren';
import { Field, Modal, Badge, Spinner, EmptyState, StatCard } from '../components/ui';
import { fmtDate } from '../lib/date';

export const Route = createFileRoute('/consents')({
  component: ConsentsPage,
});

const FORM_STATUS_VARIANT: Record<ConsentFormStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  signed: 'success',
  declined: 'danger',
};

// A form is overdue when it is still awaiting signature (pending) and its
// due_date is strictly before today.
const isOverdue = (f: ConsentForm) => {
  if (f.status !== 'pending' || !f.due_date) return false;
  const due = new Date(f.due_date);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
};
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

  // KPI counts. "Overdue" = a form still awaiting signature (pending) whose
  // due_date is in the past.
  const counts = useMemo(() => {
    const all = forms ?? [];
    return {
      pending: all.filter((f) => f.status === 'pending').length,
      signed: all.filter((f) => f.status === 'signed').length,
      declined: all.filter((f) => f.status === 'declined').length,
      overdue: all.filter((f) => isOverdue(f)).length,
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Awaiting signature" value={counts.pending} />
        <StatCard label="Overdue" value={counts.overdue} />
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
      <BulkSendModal
        open={issueModalOpen}
        templateId={issueTemplateId}
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
            {t.category && <Badge variant="muted">{t.category}</Badge>}
            {t.requires_signature && <Badge variant="warning">Signature required</Badge>}
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
            <th className="px-4 py-2 font-medium">Due</th>
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
              <td className="px-4 py-2 text-muted">
                <span className="flex items-center gap-1.5">
                  {fmtDate(f.due_date)}
                  {isOverdue(f) && <Badge variant="danger">Overdue</Badge>}
                </span>
              </td>
              <td className="px-4 py-2">{f.signed_by || '—'}</td>
              <td className="px-4 py-2 text-muted">{ukDateTime(f.signed_at)}</td>
              <td className="px-4 py-2 text-muted">{fmtDate(f.created_at)}</td>
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
      ? {
          title: initial.title,
          body: initial.body,
          version: initial.version,
          active: initial.active,
          requiresSignature: initial.requires_signature,
          category: initial.category ?? '',
        }
      : { active: true, requiresSignature: true },
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
      <Field label="Category" error={errors.category?.message}>
        <input
          {...register('category')}
          placeholder="e.g. Medical, Outings, Media"
          className="input"
        />
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
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('requiresSignature')} />
        Requires signature
      </label>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

// --- Bulk send modal ---

// "Send" issues a template to many children at once. The manager picks
// recipients from the active children (with select-all) plus an optional due
// date; the API skips children that already have a pending form for this
// template and returns how many forms were created.
function BulkSendModal({
  open,
  templateId,
  onClose,
}: {
  open: boolean;
  templateId: number | null;
  onClose: () => void;
}) {
  const { data: templates } = useConsentTemplates();
  const { data: children, isLoading: childrenLoading } = useChildren();
  const bulkSend = useBulkSend();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dueDate, setDueDate] = useState('');

  const template = useMemo(
    () => templates?.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  // Only active children can be sent a form.
  const activeChildren = useMemo(
    () => (children ?? []).filter((c) => c.status === 'Active'),
    [children],
  );

  const allSelected = activeChildren.length > 0 && selected.size === activeChildren.length;

  const toggleChild = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(activeChildren.map((c) => c.id)));

  const close = () => {
    setSelected(new Set());
    setDueDate('');
    onClose();
  };

  const onSend = () => {
    if (templateId == null || selected.size === 0) return;
    bulkSend.mutate(
      { templateId, childIds: [...selected], dueDate: dueDate || undefined },
      { onSuccess: close },
    );
  };

  return (
    <Modal
      // Reset selection whenever a different template is chosen for sending.
      key={templateId ?? 'none'}
      open={open}
      onClose={close}
      title={template ? `Send "${template.title}"` : 'Send consent form'}
    >
      <div className="space-y-4">
        <Field label="Due date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input"
          />
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Recipients ({selected.size} selected)
            </span>
            {activeChildren.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                Select all
              </label>
            )}
          </div>

          {childrenLoading ? (
            <Spinner />
          ) : activeChildren.length === 0 ? (
            <EmptyState title="No active children" description="Add a child to send consent forms." />
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {activeChildren.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-900 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleChild(c.id)}
                  />
                  <span className="truncate">{c.name}</span>
                  {c.room && <span className="ml-auto text-xs text-muted">{c.room}</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        {bulkSend.data && (
          <p className="text-sm text-success">{bulkSend.data.created} form(s) created.</p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-primary"
            onClick={onSend}
            disabled={bulkSend.isPending || selected.size === 0 || templateId == null}
          >
            {bulkSend.isPending ? 'Sending…' : `Send to ${selected.size || 0} child(ren)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
