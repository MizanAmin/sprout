import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useInvoices,
  useCreateInvoice,
  useMarkInvoicePaid,
  useSendInvoiceReminder,
  useDeleteInvoice,
  type InvoiceStatus,
} from '../features/invoices/useInvoices';
import { InvoiceModal } from '../features/invoices/InvoiceModal';
import { Badge, Spinner, EmptyState, gbp } from '../components/ui';

export const Route = createFileRoute('/invoices')({ component: InvoicesPage });

const STATUS_VARIANT: Record<InvoiceStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  Paid: 'success',
  Pending: 'warning',
  Overdue: 'danger',
  Cancelled: 'muted',
};

function InvoicesPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: invoices, isLoading } = useInvoices(status ? { status } : {});
  const createInvoice = useCreateInvoice();
  const markPaid = useMarkInvoicePaid();
  const sendReminder = useSendInvoiceReminder();
  const deleteInvoice = useDeleteInvoice();

  const filtered = (invoices ?? []).filter(
    (i) =>
      !search ||
      i.child_name.toLowerCase().includes(search.toLowerCase()) ||
      i.invoice_ref.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          Create invoice
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search child or ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title="No invoices" description="Create one or adjust your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Ref</th>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{inv.invoice_ref}</td>
                  <td className="px-4 py-2">{inv.child_name}</td>
                  <td className="px-4 py-2">{inv.period}</td>
                  <td className="px-4 py-2">{gbp(Number(inv.amount))}</td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                  </td>
                  <td className="px-4 py-2">{inv.due_date ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                      <button className="text-sm text-success" onClick={() => markPaid.mutate(inv.id)}>
                        Mark paid
                      </button>
                    )}
                    {inv.status === 'Overdue' && (
                      <button
                        className="ml-3 text-sm text-primary"
                        onClick={() => sendReminder.mutate(inv.id)}
                      >
                        Remind
                      </button>
                    )}
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete invoice ${inv.invoice_ref}?`)) deleteInvoice.mutate(inv.id);
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

      <InvoiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        submitting={createInvoice.isPending}
        onSubmit={(data) => createInvoice.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}
