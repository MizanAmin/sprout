import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useMarkInvoicePaid,
  useSendInvoiceReminder,
  useDeleteInvoice,
  type Invoice,
  type InvoiceStatus,
  type InvoiceUpdateInput,
} from '../features/invoices/useInvoices';
import { InvoiceModal } from '../features/invoices/InvoiceModal';
import { StatCard, Badge, Spinner, EmptyState, gbp } from '../components/ui';
import { printDocument, printHeader, escapeHtml } from '../lib/print';
import type { InvoiceCreateInput } from '@sprout/schemas';

export const Route = createFileRoute('/invoices')({ component: InvoicesPage });

const STATUS_VARIANT: Record<InvoiceStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  Paid: 'success',
  Pending: 'warning',
  Overdue: 'danger',
  Cancelled: 'muted',
};

// en-GB date for due/issue columns; tolerates null and ISO/date strings.
const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

// Map invoice status to the print stylesheet's pill colour classes.
const STATUS_PILL: Record<InvoiceStatus, 'green' | 'amber' | 'red' | 'grey'> = {
  Paid: 'green',
  Pending: 'amber',
  Overdue: 'red',
  Cancelled: 'grey',
};

// Build a branded, printable invoice document and open the browser print dialog.
function printInvoice(inv: Invoice) {
  const amount = Number(inv.amount);
  const paid = Number(inv.amount_paid) || 0;
  const balance = Math.max(0, amount - paid);
  const items = inv.line_items ?? [];

  const rows =
    items.length > 0
      ? items
          .map((li) => {
            const hasSession = li.hours != null && li.rate != null;
            const detail = hasSession
              ? `${escapeHtml(li.hours)} × ${gbp(Number(li.rate))}`
              : '';
            return `<tr>
              <td>${escapeHtml(li.description)}</td>
              <td class="right muted">${detail}</td>
              <td class="right">${gbp(Number(li.amount))}</td>
            </tr>`;
          })
          .join('')
      : `<tr>
          <td>${escapeHtml(inv.period ? `Childcare — ${inv.period}` : 'Childcare')}</td>
          <td class="right muted"></td>
          <td class="right">${gbp(amount)}</td>
        </tr>`;

  const body = `
    ${printHeader('Invoice ' + escapeHtml(inv.invoice_ref))}
    <table style="margin-bottom:20px">
      <tr>
        <td style="border:none;vertical-align:top;width:50%">
          <div class="muted">Bill to</div>
          <div style="font-weight:700;font-size:14px">${escapeHtml(inv.child_name)}</div>
        </td>
        <td style="border:none;vertical-align:top;text-align:right">
          <div><span class="muted">Period:</span> ${escapeHtml(inv.period || '—')}</div>
          <div><span class="muted">Issued:</span> ${escapeHtml(fmtDate(inv.created_at))}</div>
          <div><span class="muted">Due:</span> ${escapeHtml(fmtDate(inv.due_date))}</div>
          <div style="margin-top:6px">
            <span class="pill ${STATUS_PILL[inv.status]}">${escapeHtml(inv.status)}</span>
          </div>
        </td>
      </tr>
    </table>

    <table>
      <thead>
        <tr><th>Description</th><th class="right">Detail</th><th class="right">Amount</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot class="totals">
        <tr><td></td><td class="right">Total</td><td class="right">${gbp(amount)}</td></tr>
        <tr><td></td><td class="right">Paid</td><td class="right">${gbp(paid)}</td></tr>
        <tr><td></td><td class="right">Balance due</td><td class="right">${gbp(balance)}</td></tr>
      </tfoot>
    </table>

    ${inv.notes ? `<h2>Notes</h2><div class="muted">${escapeHtml(inv.notes)}</div>` : ''}
  `;

  printDocument('Invoice ' + inv.invoice_ref, body);
}

function InvoicesPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);

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

  // KPI tiles mirror the reference: totals across the unfiltered fetch.
  const kpis = useMemo(() => {
    const list = invoices ?? [];
    const sum = (s: InvoiceStatus) =>
      list.filter((f) => f.status === s).reduce((a, f) => a + Number(f.amount), 0);
    return {
      count: list.length,
      collected: sum('Paid'),
      pending: sum('Pending'),
      overdue: sum('Overdue'),
    };
  }, [invoices]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add invoice
        </button>
      </div>

      {/* KPI snapshot */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Invoices" value={kpis.count} />
        <StatCard label="Collected" value={gbp(kpis.collected)} />
        <StatCard label="Pending" value={gbp(kpis.pending)} />
        <StatCard label="Overdue" value={gbp(kpis.overdue)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search by child or ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-[12rem]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
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
        <EmptyState
          title="No invoices"
          description="Click Add invoice to create one, or adjust your filters."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Ref</th>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Amount &amp; Balance</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((inv) => {
                const amount = Number(inv.amount);
                const paid = Number(inv.amount_paid) || 0;
                const remain = Math.max(0, amount - paid);
                const pct = amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;
                const partial = paid > 0 && inv.status !== 'Paid';
                return (
                  <tr key={inv.id} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-muted">{inv.invoice_ref}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{inv.child_name}</td>
                    <td className="px-4 py-2 text-muted">{inv.period || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="font-semibold text-gray-900">{gbp(amount)}</div>
                      {inv.status === 'Paid' ? (
                        <div className="mt-0.5 text-xs text-success">✓ Fully paid</div>
                      ) : partial ? (
                        <div className="mt-1">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-info"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="mt-0.5 text-xs text-muted">
                            {gbp(paid)} paid ·{' '}
                            <span className="font-medium text-warning">{gbp(remain)} due</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-0.5 text-xs text-muted">Balance: {gbp(amount)}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted">{fmtDate(inv.due_date)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-3">
                        <button className="text-primary" onClick={() => openEdit(inv)}>
                          Edit
                        </button>
                        <button className="text-primary" onClick={() => printInvoice(inv)}>
                          PDF
                        </button>
                        {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                          <button
                            className="text-success"
                            disabled={markPaid.isPending}
                            onClick={() => markPaid.mutate(inv.id)}
                          >
                            Mark paid
                          </button>
                        )}
                        {(inv.status === 'Pending' || inv.status === 'Overdue') && (
                          <button
                            className="text-primary"
                            disabled={sendReminder.isPending}
                            onClick={() => sendReminder.mutate(inv.id)}
                          >
                            Remind
                          </button>
                        )}
                        <button
                          className="text-danger"
                          onClick={() => {
                            if (confirm(`Delete invoice ${inv.invoice_ref}?`))
                              deleteInvoice.mutate(inv.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InvoiceFormModal
        open={modalOpen}
        editing={editing}
        onClose={closeModal}
        createSubmitting={createInvoice.isPending}
        onCreate={(data) => createInvoice.mutate(data, { onSuccess: closeModal })}
      />
    </div>
  );
}

// Wrapper so the edit-update mutation is keyed to the invoice id, and the form
// remounts (resetting defaults) whenever we switch between add/edit targets.
function InvoiceFormModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Invoice | null;
  onClose: () => void;
  onCreate: (data: InvoiceCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateInvoice = useUpdateInvoice(editing?.id ?? 0);
  return (
    <InvoiceModal
      key={editing ? `edit-${editing.id}` : 'add'}
      open={open}
      editing={editing}
      onClose={onClose}
      submitting={editing ? updateInvoice.isPending : createSubmitting}
      onSubmit={onCreate}
      onUpdate={(data: InvoiceUpdateInput) =>
        updateInvoice.mutate(data, { onSuccess: onClose })
      }
    />
  );
}
