import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StatCard, Spinner, EmptyState } from '../components/ui';
import { useFundedHours } from '../features/funded-hours/useFundedHours';

export const Route = createFileRoute('/funded-hours')({
  component: FundedHoursPage,
});

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

// Monday of the current week as YYYY-MM-DD.
function currentMondayISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function FundedHoursPage() {
  const weekStart = useMemo(currentMondayISO, []);
  const { data, isLoading } = useFundedHours(weekStart);
  const children = data?.children ?? [];

  const childrenWithHours = children.filter((c) => c.total > 0).length;

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Funded Hours</h1>

      <p className="text-sm text-muted">
        Funded hours per active child for the week of {data?.weekStart ?? weekStart}
        {data?.weekEnd ? ` – ${data.weekEnd}` : ''}.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active children" value={data ? children.length : '—'} />
        <StatCard label="Children with funded hours" value={data ? childrenWithHours : '—'} />
        <StatCard
          label="Total funded hours (week)"
          value={data ? data.totalFundedHours : '—'}
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : children.length === 0 ? (
        <EmptyState title="No children" description="No active children for this week." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
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
                  <td className="px-4 py-2 text-gray-900">{c.name}</td>
                  <td className="px-4 py-2 text-muted">{c.room || '—'}</td>
                  {DAYS.map((d) => (
                    <td key={d} className="px-4 py-2 text-right text-gray-900">
                      {c.days[d] ?? 0}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
