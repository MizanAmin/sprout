import { useState, type ReactNode } from 'react';
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
  type ConsentFormStatus,
} from '../features/consents/useConsents';
import { useChildren } from '../features/children/useChildren';
import { Field, Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/consents')({
  component: ConsentsPage,
});

type Tab = 'forms' | 'templates';

const FORM_STATUS_VARIANT: Record<ConsentFormStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  signed: 'success',
  declined: 'danger',
};

function ConsentsPage() {
  const [tab, setTab] = useState<Tab>('forms');

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Consent Forms</h1>

      <div className="flex gap-1 border-b border-border">
        <TabButton active={tab === 'forms'} onClick={() => setTab('forms')}>
          Forms
        </TabButton>
        <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
          Templates
        </TabButton>
      </div>

      {tab === 'forms' ? <FormsTab /> : <TemplatesTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

// --- Forms tab ---

function FormsTab() {
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: forms, isLoading } = useConsentForms(status ? { status } : {});
  const createForm = useCreateConsentForm();
  const updateStatus = useUpdateConsentFormStatus();
  const deleteForm = useDeleteConsentForm();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select
          className="input max-w-[12rem]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="signed">Signed</option>
          <option value="declined">Declined</option>
        </select>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          Issue form
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (forms ?? []).length === 0 ? (
        <EmptyState title="No consent forms" description="Issue one or adjust your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Signed by</th>
                <th className="px-4 py-2 font-medium">Signed at</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(forms ?? []).map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{f.child_name || '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant={FORM_STATUS_VARIANT[f.status]}>{f.status}</Badge>
                  </td>
                  <td className="px-4 py-2">{f.signed_by || '—'}</td>
                  <td className="px-4 py-2">
                    {f.signed_at ? new Date(f.signed_at).toLocaleDateString('en-GB') : '—'}
                  </td>
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
      )}

      <IssueFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        submitting={createForm.isPending}
        onSubmit={(data) => createForm.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Empty string → undefined so optional numeric selects don't become NaN.
const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

function IssueFormModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ConsentFormCreateInput) => void;
  submitting?: boolean;
}) {
  const { data: templates } = useConsentTemplates();
  const { data: children } = useChildren();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsentFormCreateInput>({
    resolver: zodResolver(consentFormCreateSchema),
    defaultValues: { status: 'pending' },
  });

  return (
    <Modal open={open} onClose={onClose} title="Issue consent form">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Template" error={errors.templateId?.message}>
          <select {...register('templateId', numberOpt)} className="input" defaultValue="">
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
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Issuing…' : 'Issue form'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Templates tab ---

function TemplatesTab() {
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: templates, isLoading } = useConsentTemplates();
  const createTemplate = useCreateConsentTemplate();
  const deleteTemplate = useDeleteConsentTemplate();

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (t: ConsentTemplate) => {
    setEditing(t);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openAdd}>
          Add template
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (templates ?? []).length === 0 ? (
        <EmptyState title="No templates" description="Create one to start issuing consent forms." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(templates ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{t.title}</td>
                  <td className="px-4 py-2">{t.version}</td>
                  <td className="px-4 py-2">
                    <Badge variant={t.active ? 'success' : 'muted'}>
                      {t.active ? 'Active' : 'Archived'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(t)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete template "${t.title}"?`)) deleteTemplate.mutate(t.id);
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

      <TemplateModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createTemplate.isPending}
        onCreate={(data) => createTemplate.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

function TemplateModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: ConsentTemplate | null;
  onClose: () => void;
  onCreate: (data: ConsentTemplateCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateTemplate = useUpdateConsentTemplate(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.title}` : 'Add template'}>
      <TemplateForm
        key={editing?.id ?? 'new'}
        initial={editing ?? undefined}
        submitting={editing ? updateTemplate.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateTemplate.mutate(data, { onSuccess: onClose }) : onCreate(data)
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
      <Field label="Title" error={errors.title?.message}>
        <input {...register('title')} className="input" />
      </Field>
      <Field label="Version" error={errors.version?.message}>
        <input {...register('version')} placeholder="1.0" className="input" />
      </Field>
      <Field label="Body" error={errors.body?.message}>
        <textarea {...register('body')} className="input" rows={6} />
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
