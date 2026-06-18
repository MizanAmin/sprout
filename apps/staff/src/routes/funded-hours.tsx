import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StatCard, Spinner, EmptyState, Badge } from '../components/ui';
import { fmtDate } from '../lib/date';
import { useFundedHours } from '../features/funded-hours/useFundedHours';

export const Route = createFileRoute('/funded-hours')({
  component: FundedHoursPage,
});

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

// Monday of the week containing `d`, as YYYY-MM-DD.
function weekMondayISO(d: Date = new Date()): string {
  const dt = new Date(d);
  const day = dt.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt.toISOString().slice(0, 10);
}

// Shift a YYYY-MM-DD Monday by a number of days, staying a YYYY-MM-DD string.
function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtHrs(h: number): string {
  return `${(Number(h) || 0).toFixed(1)} hrs`;
}

function FundedHoursPage() {
  const currentMonday = useMemo(() => weekMondayISO(), []);
  const [weekStart, setWeekStart] = useState(currentMonday);

  const { data, isLoading } = useFundedHours(weekStart);
  const children = data?.children ?? [];

  const childrenWithHours = children.filter((c) => c.total > 0).length;
  const isCurrentWeek = weekStart === currentMonday;

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Funded Hours Report</h1>

      {/* Toolbar: week selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            className="btn-outline btn-sm"
            onClick={() => setWeekStart(shiftISO(weekStart, -7))}
            title="Previous week"
            aria-label="Previous week"
          >
            ◀
          </button>
          <div className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold text-primary">
            W/C {fmtDate(weekStart)}
          </div>
          <button
            className="btn-outline btn-sm"
            onClick={() => setWeekStart(shiftISO(weekStart, 7))}
            disabled={isCurrentWeek}
            title="Next week"
            aria-label="Next week"
          >
            ▶
          </button>
          {!isCurrentWeek && (
            <button className="btn-outline btn-sm" onClick={() => setWeekStart(currentMonday)}>
              Today
            </button>
          )}
        </div>
        <p className="text-sm text-muted">
          Week of {data?.weekStart ?? weekStart}
          {data?.weekEnd ? ` – ${data.weekEnd}` : ''}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active children" value={data ? children.length : '—'} />
        <StatCard label="Children with funded hours" value={data ? childrenWithHours : '—'} />
        <StatCard
          label="Total funded hours (this week)"
          value={data ? fmtHrs(data.totalFundedHours) : '—'}
        />
      </div>
      {/* TODO: headcount-by-room and headcount-by-age-band cards from the
          reference need a /funded-hours summary (by_room / by_age_band / EYFS
          15-30hr entitlement bands) endpoint — not exposed by GET /funded-hours. */}

      {/* Per-child detail */}
      {isLoading ? (
        <Spinner />
      ) : children.length === 0 ? (
        <EmptyState title="No children" description="No active children for this week." />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="text-base font-semibold text-gray-900">Individual child detail</span>
            <Badge variant="info">
              {children.length} {children.length === 1 ? 'child' : 'children'}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-2 font-medium">Child</th>
                  <th className="px-4 py-2 font-medium">Room</th>
                  {DAYS.map((d) => (
                    <th key={d} className="px-4 py-2 text-right font-medium">
                      {d}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {children.map((c) => (
                  <tr key={c.childId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-2 text-muted">{c.room || '—'}</td>
                    {DAYS.map((d) => (
                      <td key={d} className="px-4 py-2 text-right text-gray-900">
                        {c.days[d] ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-primary">{c.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-gray-50 font-semibold text-gray-900">
                  <td className="px-4 py-2" colSpan={2}>
                    Total
                  </td>
                  {DAYS.map((d) => (
                    <td key={d} className="px-4 py-2 text-right">
                      {children.reduce((sum, c) => sum + (c.days[d] ?? 0), 0)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">{data?.totalFundedHours ?? 0}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
