import { createFileRoute } from '@tanstack/react-router';
import { StatCard, Spinner, EmptyState, gbp } from '../components/ui';
import {
  useReportsOverview,
  useChildrenByRoom,
  useFinanceSummary,
} from '../features/reports/useReports';

export const Route = createFileRoute('/revenue-report')({
  component: RevenueReportPage,
});

function RevenueReportPage() {
  const overview = useReportsOverview();
  const finance = useFinanceSummary();
  const byRoom = useChildrenByRoom();

  const rooms = byRoom.data ?? [];

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Revenue Report</h1>

      <p className="text-sm text-muted">Financial overview and headline figures.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Collected" value={finance.data ? gbp(finance.data.collected) : '—'} />
        <StatCard label="Pending" value={finance.data ? gbp(finance.data.pending) : '—'} />
        <StatCard
          label="Overdue"
          value={
            finance.data ? (
              <span className={finance.data.overdue > 0 ? 'text-danger' : undefined}>
                {gbp(finance.data.overdue)}
              </span>
            ) : (
              '—'
            )
          }
        />
        <StatCard
          label="Collection rate"
          value={finance.data ? `${finance.data.collectionRate}%` : '—'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active children" value={overview.data?.activeChildren ?? '—'} />
        <StatCard
          label="Attendance today"
          value={overview.data ? `${overview.data.attendanceTodayPct}%` : '—'}
        />
        <StatCard label="Activities (30d)" value={overview.data?.activities30d ?? '—'} />
        <StatCard label="Avg EYFS score" value={overview.data?.avgEyfsScore ?? '—'} />
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Active children by room</h2>
        {byRoom.isLoading ? (
          <Spinner />
        ) : rooms.length === 0 ? (
          <EmptyState title="No rooms" description="No active children grouped by room." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-medium">Room</th>
                <th className="py-2 text-right font-medium">Children</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.room} className="border-b border-border last:border-0">
                  <td className="py-2 text-gray-900">{r.room || '—'}</td>
                  <td className="py-2 text-right text-gray-900">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
