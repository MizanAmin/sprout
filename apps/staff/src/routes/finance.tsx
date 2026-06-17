import { createFileRoute, Link } from '@tanstack/react-router';
import { StatCard, Spinner, EmptyState, gbp } from '../components/ui';
import { useFinanceSummary, useOverdue, useSendReminder } from '../features/finance/useFinance';

export const Route = createFileRoute('/finance')({
  component: FinancePage,
});

function FinancePage() {
  const summary = useFinanceSummary();
  const overdue = useOverdue();
  const sendReminder = useSendReminder();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Finance</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Collected" value={summary.data ? gbp(summary.data.collected) : '—'} />
        <StatCard label="Pending" value={summary.data ? gbp(summary.data.pending) : '—'} />
        <StatCard label="Overdue" value={summary.data ? gbp(summary.data.overdue) : '—'} />
        <StatCard
          label="Collection Rate"
          value={summary.data ? `${Math.round(summary.data.collectionRate)}%` : '—'}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/invoices" className="btn-primary">
          View Invoices
        </Link>
        <Link to="/revenue-report" className="btn-primary">
          Revenue Report
        </Link>
        <Link to="/funded-hours" className="btn-primary">
          Funded Hours
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Overdue priority</h2>
        {overdue.isLoading ? (
          <Spinner />
        ) : !overdue.data?.length ? (
          <EmptyState title="No overdue invoices" description="Everything is up to date." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Ref</th>
                <th className="px-4 py-2 font-medium">Outstanding</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Reminders</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overdue.data.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{row.child_name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.invoice_ref}</td>
                  <td className="px-4 py-2 font-medium text-danger">
                    {gbp(Number(row.outstanding))}
                  </td>
                  <td className="px-4 py-2">{row.due_date ?? '—'}</td>
                  <td className="px-4 py-2">{row.reminder_count}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-sm text-primary disabled:opacity-50"
                      disabled={sendReminder.isPending}
                      onClick={() => sendReminder.mutate(row.id)}
                    >
                      Send Reminder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
