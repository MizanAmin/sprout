import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { StatCard, Badge, Spinner, EmptyState, gbp } from '../components/ui';

export const Route = createFileRoute('/dashboard')({ component: DashboardPage });

interface Overview {
  attendanceTodayPct: number;
  activeChildren: number;
  activities30d: number;
  avgEyfsScore: number;
}
interface FinanceSummary {
  collected: number;
  pending: number;
  overdue: number;
  collectionRate: number;
}
interface CalendarEvent {
  id: number;
  title: string;
  start_date: string;
  color: string;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function DashboardPage() {
  const overview = useQuery({
    queryKey: ['reports', 'overview'],
    queryFn: () => api.get<Overview>('/reports/overview'),
  });
  const finance = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => api.get<FinanceSummary>('/finance/summary'),
  });
  const unread = useQuery({
    queryKey: ['messages', 'unread'],
    queryFn: () => api.get<{ count: number }>('/messages/unread'),
  });

  const today = new Date();
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const events = useQuery({
    queryKey: ['calendar', 'upcoming'],
    queryFn: () =>
      api.get<CalendarEvent[]>(`/calendar?from=${isoDate(today)}&to=${isoDate(weekAhead)}`),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        {overview.data && (
          <Badge variant="info">EYFS avg {overview.data.avgEyfsScore.toFixed(1)}</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Children" value={overview.data?.activeChildren ?? '—'} />
        <StatCard
          label="Present Today"
          value={overview.data ? `${overview.data.attendanceTodayPct}%` : '—'}
        />
        <StatCard label="Overdue Invoices" value={finance.data ? gbp(finance.data.overdue) : '—'} />
        <StatCard label="Unread Messages" value={unread.data?.count ?? '—'} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/register" className="btn-primary">
          Open Register
        </Link>
        <Link to="/children" className="btn-primary">
          New Child
        </Link>
        <Link to="/invoices" className="btn-primary">
          New Invoice
        </Link>
        <Link to="/messages" className="btn-primary">
          Message Parent
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Upcoming (next 7 days)</h2>
          <Link to="/calendar" className="text-sm text-primary">
            View calendar →
          </Link>
        </div>
        {events.isLoading ? (
          <Spinner />
        ) : !events.data?.length ? (
          <EmptyState title="No upcoming events" />
        ) : (
          <ul className="divide-y divide-border">
            {events.data.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                <span className="text-sm text-gray-900">{e.title}</span>
                <span className="ml-auto text-xs text-muted">{e.start_date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
