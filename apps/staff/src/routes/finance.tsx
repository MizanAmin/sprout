import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { StatCard, Badge, Spinner, EmptyState, gbp } from '../components/ui';
import { useFinanceSummary, useRevenue, useOverdue, useSendReminder } from '../features/finance/useFinance';
import { useInvoices, type InvoiceStatus } from '../features/invoices/useInvoices';

export const Route = createFileRoute('/finance')({
  component: FinancePage,
});

// Map invoice status → Badge variant (Paid=success, Overdue=danger, Pending=warning).
const STATUS_VARIANT: Record<InvoiceStatus, 'success' | 'danger' | 'warning' | 'muted'> = {
  Paid: 'success',
  Overdue: 'danger',
  Pending: 'warning',
  Cancelled: 'muted',
};

function FinancePage() {
  const navigate = useNavigate();
  const summary = useFinanceSummary();
  const revenue = useRevenue();
  const overdue = useOverdue();
  const invoices = useInvoices();
  const sendReminder = useSendReminder();

  const goInvoices = () => navigate({ to: '/invoices' });
  const outstanding = revenue.data?.kpis.outstanding;

  // Most recent invoices first.
  const recent = (invoices.data ?? [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Finance</h1>

      {/* Headline KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={summary.data ? gbp(summary.data.collected) : '—'}
          onClick={goInvoices}
        />
        <StatCard
          label="Pending"
          value={summary.data ? gbp(summary.data.pending) : '—'}
          onClick={goInvoices}
        />
        <StatCard
          label="Overdue"
          value={summary.data ? gbp(summary.data.overdue) : '—'}
          hint={outstanding != null ? `${gbp(outstanding)} outstanding` : undefined}
          onClick={goInvoices}
        />
        <StatCard
          label="Collection Rate"
          value={summary.data ? `${Math.round(summary.data.collectionRate)}%` : '—'}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/invoices" className="btn-primary">
          View Invoices
        </Link>
        <Link to="/revenue-report" className="btn-outline">
          Revenue Report
        </Link>
        <Link to="/funded-hours" className="btn-outline">
          Funded Hours
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Overdue priority list */}
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Overdue priority</h2>
            {overdue.data?.length ? (
              <Badge variant="danger">{overdue.data.length} overdue</Badge>
            ) : null}
          </div>
          {overdue.isLoading ? (
            <Spinner />
          ) : !overdue.data?.length ? (
            <EmptyState title="No overdue invoices" description="Everything is up to date." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Child</th>
                  <th className="px-4 py-2 font-medium">Outstanding</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overdue.data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{row.child_name}</td>
                    <td className="px-4 py-2 font-medium text-danger">
                      {gbp(Number(row.outstanding))}
                    </td>
                    <td className="px-4 py-2">{row.due_date ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="btn-outline btn-sm"
                        disabled={sendReminder.isPending}
                        onClick={() => sendReminder.mutate(row.id)}
                      >
                        Remind
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Recent invoices with status badges */}
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent invoices</h2>
            <Link to="/invoices" className="text-sm text-primary">
              View all →
            </Link>
          </div>
          {invoices.isLoading ? (
            <Spinner />
          ) : !recent.length ? (
            <EmptyState title="No invoices yet" description="Create an invoice to get started." />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {inv.child_name}
                    </div>
                    <div className="text-xs text-muted">
                      {inv.invoice_ref}
                      {inv.period ? ` · ${inv.period}` : ''}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                    <span className="w-20 text-right text-sm font-semibold text-gray-900">
                      {gbp(Number(inv.amount))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
