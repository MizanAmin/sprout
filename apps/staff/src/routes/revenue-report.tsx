import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StatCard, Spinner, EmptyState, Badge, gbp } from '../components/ui';
import { useRevenue, type RevenueReport } from '../features/finance/useFinance';

export const Route = createFileRoute('/revenue-report')({
  component: RevenueReportPage,
});

const PERIODS = ['3M', '6M', '12M', '24M'] as const;
type Period = (typeof PERIODS)[number];

function RevenueReportPage() {
  const [period, setPeriod] = useState<Period>('12M');
  const revenue = useRevenue(period);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Revenue Report</h1>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={
                p === period
                  ? 'btn-primary px-3 py-1.5 text-sm'
                  : 'btn-outline px-3 py-1.5 text-sm'
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted">
        Monthly income, debt aging and outstanding balances by child.
      </p>

      {revenue.isLoading ? (
        <Spinner />
      ) : !revenue.data ? (
        <EmptyState title="No revenue data" description="Could not load the revenue report." />
      ) : (
        <RevenueContent report={revenue.data} period={period} />
      )}
    </div>
  );
}

function RevenueContent({ report, period }: { report: RevenueReport; period: Period }) {
  const { kpis, monthly, aging, byChild, byType, invoiceCount } = report;
  const collectionTone =
    kpis.collectionRate >= 90
      ? 'text-success'
      : kpis.collectionRate >= 70
        ? 'text-warning'
        : 'text-danger';

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total invoiced" value={gbp(kpis.totalInvoiced)} hint={`Last ${period}`} />
        <StatCard
          label="Collected"
          value={<span className="text-success">{gbp(kpis.collected)}</span>}
          hint="Amount paid"
        />
        <StatCard
          label="Collection rate"
          value={<span className={collectionTone}>{kpis.collectionRate}%</span>}
        />
        <StatCard
          label="Outstanding"
          value={
            <span className={kpis.outstanding > 0 ? 'text-warning' : undefined}>
              {gbp(kpis.outstanding)}
            </span>
          }
          hint={`${gbp(kpis.avgPerChild)} avg per child · ${invoiceCount} invoice${
            invoiceCount === 1 ? '' : 's'
          }`}
        />
      </div>

      {/* Monthly income bar chart */}
      <MonthlyChart monthly={monthly} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgingBreakdown aging={aging} />
        <ByTypeBreakdown byType={byType} invoiceCount={invoiceCount} />
      </div>

      <ByChildTable byChild={byChild} />
    </>
  );
}

// Invoiced total broken down by invoice status (Paid / Pending / Overdue).
function ByTypeBreakdown({
  byType,
  invoiceCount,
}: {
  byType: RevenueReport['byType'];
  invoiceCount: number;
}) {
  const total = byType.reduce((sum, r) => sum + r.total, 0);
  const toneFor = (type: string): string =>
    type === 'Paid'
      ? 'bg-success'
      : type === 'Overdue'
        ? 'bg-danger'
        : type === 'Pending'
          ? 'bg-warning'
          : 'bg-info';

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Invoiced by status</h2>
        <span className="text-xs text-muted">
          {invoiceCount} invoice{invoiceCount === 1 ? '' : 's'}
        </span>
      </div>
      {byType.length === 0 ? (
        <EmptyState title="No invoices" description="No invoices for this nursery." />
      ) : (
        <div className="space-y-3">
          {byType.map((r) => {
            const pct = total > 0 ? Math.round((r.total / total) * 100) : 0;
            return (
              <div key={r.type} className="flex items-center gap-3">
                <span className="w-20 flex-shrink-0 text-xs text-muted">
                  {r.type}
                  <span className="ml-1 text-gray-400">({r.count})</span>
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                  <div className={`h-full rounded-full ${toneFor(r.type)}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-20 text-right text-sm font-semibold text-gray-900">
                  {gbp(r.total)}
                </span>
                <span className="w-8 text-right text-xs text-muted">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MonthlyChart({ monthly }: { monthly: RevenueReport['monthly'] }) {
  const maxVal = Math.max(...monthly.map((m) => m.invoiced), 1);

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Monthly income</h2>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success" />
            Collected
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-warning" />
            Outstanding
          </span>
        </div>
      </div>

      {monthly.length === 0 ? (
        <EmptyState title="No invoice data" description="No invoices for this period." />
      ) : (
        <div className="flex h-48 items-end gap-2">
          {monthly.map((m) => {
            const outstanding = Math.max(m.invoiced - m.collected, 0);
            const collectedPct = (m.collected / maxVal) * 100;
            const outstandingPct = (outstanding / maxVal) * 100;
            const label = formatMonth(m.month);
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="flex w-full flex-col justify-end"
                  style={{ height: '100%' }}
                  title={`${label}: ${gbp(m.invoiced)} invoiced · ${gbp(m.collected)} collected · ${gbp(outstanding)} outstanding`}
                >
                  {outstandingPct > 0 && (
                    <div
                      className="w-full rounded-t-sm bg-warning"
                      style={{ height: `${outstandingPct}%` }}
                    />
                  )}
                  <div
                    className={`w-full bg-success ${outstandingPct > 0 ? '' : 'rounded-t-sm'}`}
                    style={{ height: `${collectedPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AgingBreakdown({ aging }: { aging: RevenueReport['aging'] }) {
  const rows: { label: string; value: number; tone: string }[] = [
    { label: '0–30 days', value: aging.d0_30, tone: 'bg-info' },
    { label: '31–60 days', value: aging.d31_60, tone: 'bg-warning' },
    { label: '61–90 days', value: aging.d61_90, tone: 'bg-warning' },
    { label: '90+ days', value: aging.d90_plus, tone: 'bg-danger' },
  ];
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <section className="card">
      <h2 className="mb-4 font-semibold text-gray-900">Debt aging</h2>
      {total === 0 ? (
        <EmptyState title="No outstanding debt" description="Nothing currently overdue." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-24 flex-shrink-0 text-xs text-muted">{r.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                  <div className={`h-full rounded-full ${r.tone}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-20 text-right text-sm font-semibold text-gray-900">
                  {gbp(r.value)}
                </span>
                <span className="w-8 text-right text-xs text-muted">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ByChildTable({ byChild }: { byChild: RevenueReport['byChild'] }) {
  return (
    <section className="card">
      <h2 className="mb-3 font-semibold text-gray-900">Outstanding by child</h2>
      {byChild.length === 0 ? (
        <EmptyState title="All settled" description="No outstanding balances by child." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-medium">Child</th>
                <th className="py-2 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {byChild.map((c) => (
                <tr key={c.child_id} className="border-b border-border last:border-0">
                  <td className="py-2 text-gray-900">{c.child_name}</td>
                  <td className="py-2 text-right">
                    <Badge
                      variant={
                        c.outstanding > 300 ? 'danger' : c.outstanding > 100 ? 'warning' : 'muted'
                      }
                    >
                      {gbp(c.outstanding)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// month is 'YYYY-MM' from the API.
function formatMonth(month: string): string {
  const d = new Date(`${month}-02`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleString('en-GB', { month: 'short' });
}
