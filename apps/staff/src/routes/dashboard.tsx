import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useChildren } from '../features/children/useChildren';
import { useAttendance } from '../features/attendance/useAttendance';
import { useObservations } from '../features/observations/useObservations';
import { StatCard, Badge, Spinner, EmptyState, gbp } from '../components/ui';

export const Route = createFileRoute('/dashboard')({ component: DashboardPage });

// Manager-only aggregate; mirrors the reference dashboard's headline numbers.
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

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Status badge variant, matching the reference's attBadge() colour mapping.
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  'not marked': 'muted',
};

// First name + last initial, e.g. "Ava T".
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function DashboardPage() {
  const today = isoDate(new Date());

  const overview = useQuery({
    queryKey: ['reports', 'overview'],
    queryFn: () => api.get<Overview>('/reports/overview'),
  });
  const finance = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => api.get<FinanceSummary>('/finance/summary'),
  });
  const { data: children } = useChildren();
  const { data: attendance, isLoading: attendanceLoading } = useAttendance(today);
  const { data: observations, isLoading: observationsLoading } = useObservations();

  const active = (children ?? []).filter((c) => c.status === 'Active');
  const byChild = new Map((attendance ?? []).map((a) => [a.child_id, a]));

  const present = (attendance ?? []).filter(
    (a) => a.status === 'present' || a.status === 'late',
  ).length;
  const absent = (attendance ?? []).filter((a) => a.status === 'absent').length;
  const obsToday = (observations ?? []).filter((o) => o.obs_date === today).length;
  const recentObs = (observations ?? [])
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="space-y-6 p-6">
      {/* Greeting header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{greeting()}</h1>
          <p className="mt-1 text-sm text-muted">
            Here's what's happening at your nursery today.
          </p>
        </div>
        {overview.data && (
          <Badge variant="info">EYFS avg {overview.data.avgEyfsScore.toFixed(1)}</Badge>
        )}
      </div>

      {/* Headline stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Present Today" value={present} hint={`${active.length} expected`} />
        <StatCard label="Absent Today" value={absent} />
        <StatCard
          label="Outstanding Invoices"
          value={finance.data ? gbp(finance.data.overdue + finance.data.pending) : '—'}
          hint={finance.data ? `${gbp(finance.data.overdue)} overdue` : undefined}
        />
        <StatCard label="Observations Today" value={obsToday} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/register" className="btn-primary">
          Open Register
        </Link>
        <Link to="/children" className="btn-primary">
          Children
        </Link>
        <Link to="/journal" className="btn-primary">
          New Observation
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Live Register summary */}
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Live Register</h2>
            <Link to="/register" className="text-sm text-primary">
              Open register →
            </Link>
          </div>
          {attendanceLoading ? (
            <Spinner />
          ) : active.length === 0 ? (
            <EmptyState title="No active children" description="Add a child to take the register." />
          ) : (
            <ul className="divide-y divide-border">
              {active.map((c) => {
                const status = byChild.get(c.id)?.status ?? 'not marked';
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-muted">{c.room || '—'}</div>
                    </div>
                    <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent observations */}
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Observations</h2>
            <Link to="/journal" className="text-sm text-primary">
              View all →
            </Link>
          </div>
          {observationsLoading ? (
            <Spinner />
          ) : recentObs.length === 0 ? (
            <EmptyState title="No observations yet" description="Record your first observation." />
          ) : (
            <ul className="divide-y divide-border">
              {recentObs.map((o) => (
                <li key={o.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {shortName(o.child_name)}
                    </span>
                    <span className="text-xs text-muted">{o.obs_date}</span>
                  </div>
                  {o.text && <p className="mt-0.5 truncate text-sm text-muted">{o.text}</p>}
                  {o.areas?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {o.areas.slice(0, 3).map((a) => (
                        <Badge key={a} variant="muted">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
