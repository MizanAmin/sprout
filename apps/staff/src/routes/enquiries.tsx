import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useEnquiries,
  useCreateEnquiry,
  useUpdateEnquiry,
  useDeleteEnquiry,
  type Enquiry,
  type EnquiryCreateInput,
  type EnquiryPriority,
  type EnquiryStatus,
} from '../features/enquiries/useEnquiries';
import { EnquiryForm } from '../features/enquiries/EnquiryForm';
import { Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/enquiries')({
  component: EnquiriesPage,
});

const PRIORITY_VARIANT: Record<EnquiryPriority, 'muted' | 'info' | 'warning' | 'danger'> = {
  Low: 'muted',
  Normal: 'info',
  High: 'warning',
  Urgent: 'danger',
};

const STATUS_VARIANT: Record<EnquiryStatus, 'info' | 'warning' | 'success' | 'muted'> = {
  New: 'info',
  Contacted: 'info',
  Toured: 'warning',
  Offered: 'warning',
  Enrolled: 'success',
  Declined: 'muted',
};

function EnquiriesPage() {
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: enquiries, isLoading } = useEnquiries(status ? { status } : {});
  const createEnquiry = useCreateEnquiry();
  const deleteEnquiry = useDeleteEnquiry();

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (e: Enquiry) => {
    setEditing(e);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Enquiries</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add enquiry
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="input max-w-[12rem]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Toured">Toured</option>
          <option value="Offered">Offered</option>
          <option value="Enrolled">Enrolled</option>
          <option value="Declined">Declined</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (enquiries ?? []).length === 0 ? (
        <EmptyState title="No enquiries" description="Add one or adjust your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Parent</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">Start</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(enquiries ?? []).map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{e.child_name}</td>
                  <td className="px-4 py-2">{e.parent_name || '—'}</td>
                  <td className="px-4 py-2">{e.email || '—'}</td>
                  <td className="px-4 py-2">{e.phone || '—'}</td>
                  <td className="px-4 py-2">{e.room || '—'}</td>
                  <td className="px-4 py-2">{e.start_date ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant={PRIORITY_VARIANT[e.priority]}>{e.priority}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[e.status]}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-2">{e.source || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => openEdit(e)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete enquiry for ${e.child_name}?`))
                          deleteEnquiry.mutate(e.id);
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

      <EnquiryModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createEnquiry.isPending}
        onCreate={(data) => createEnquiry.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Add/edit modal. Edit uses a per-enquiry update mutation hook.
function EnquiryModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Enquiry | null;
  onClose: () => void;
  onCreate: (data: EnquiryCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateEnquiry = useUpdateEnquiry(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.child_name}` : 'Add enquiry'}
    >
      <EnquiryForm
        initial={editing ?? undefined}
        submitting={editing ? updateEnquiry.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateEnquiry.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}
