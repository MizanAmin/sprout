import { createFileRoute } from '@tanstack/react-router';
import { StatCard, Spinner, EmptyState, Badge } from '../components/ui';
import {
  useReportsOverview,
  useChildrenByRoom,
  useAttendanceBreakdown,
  useEyfsByArea,
} from '../features/reports/useReports';

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
});

// Horizontal CSS bar used by the children-by-room and attendance breakdowns.
function Bar({
  label,
  value,
  max,
  color = 'bg-primary',
  labelColor = 'text-gray-900',
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  labelColor?: string;
}) {
  // Reference keeps a sliver visible for non-zero values even at low %.
  const pct = max > 0 && value > 0 ? Math.max((value / max) * 100, 4) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-28 shrink-0 text-xs font-semibold ${labelColor}`}>{label}</div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-7 text-right text-sm font-bold ${labelColor}`}>{value}</span>
    </div>
  );
}

function attendanceColor(pct: number): string {
  if (pct >= 90) return 'text-success';
  if (pct >= 70) return 'text-warning';
  return 'text-danger';
}

// EYFS area scores are 0–5; colour the card by band like the reference.
function eyfsColor(avg: number): { text: string; bar: string } {
  if (avg >= 4) return { text: 'text-success', bar: 'bg-success' };
  if (avg >= 3) return { text: 'text-info', bar: 'bg-info' };
  return { text: 'text-warning', bar: 'bg-warning' };
}

function ReportsPage() {
  const overview = useReportsOverview();
  const rooms = useChildrenByRoom();
  const attendance = useAttendanceBreakdown();
  const eyfs = useEyfsByArea();

  const o = overview.data;

  const totalActive = rooms.data?.reduce((s, r) => s + r.count, 0) ?? 0;
  const roomsMax = Math.max(1, ...(rooms.data ?? []).map((r) => r.count));

  const a = attendance.data;
  const attendanceRows = a
    ? [
        { label: 'Present', value: a.present, color: 'bg-success', text: 'text-success' },
        { label: 'Late', value: a.late, color: 'bg-warning', text: 'text-warning' },
        { label: 'Absent', value: a.absent, color: 'bg-danger', text: 'text-danger' },
        { label: 'Not yet marked', value: a.notMarked, color: 'bg-gray-300', text: 'text-muted' },
      ]
    : [];
  const attendanceTotal = a
    ? a.present + a.late + a.absent + a.notMarked
    : 0;
  const attendanceMax = Math.max(1, ...attendanceRows.map((r) => r.value));

  // Overall EYFS average across areas (mirrors the reference footer).
  const eyfsRows = eyfs.data ?? [];
  const eyfsMaxScore = 5;
  const overallEyfs =
    eyfsRows.length > 0
      ? (eyfsRows.reduce((s, r) => s + r.avgScore, 0) / eyfsRows.length).toFixed(1)
      : null;
  const totalAssessments = eyfsRows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>

      {/* Operational snapshot */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Attendance Today"
          value={o ? `${o.attendanceTodayPct}%` : '—'}
        />
        <StatCard label="Active Children" value={o?.activeChildren ?? '—'} />
        <StatCard label="Activities (30 days)" value={o?.activities30d ?? '—'} />
        <StatCard
          label="Avg EYFS Score"
          value={o ? `${o.avgEyfsScore.toFixed(1)}/5` : '—'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Children by room */}
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Children by Room</h2>
            {rooms.data && (
              <Badge variant="info">
                {rooms.data.length} room{rooms.data.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {rooms.isLoading ? (
            <Spinner />
          ) : !rooms.data?.length ? (
            <EmptyState title="No rooms set up" />
          ) : (
            <>
              <div className="space-y-3">
                {rooms.data.map((r) => (
                  <Bar key={r.room} label={r.room} value={r.count} max={roomsMax} />
                ))}
              </div>
              <div className="border-t border-border pt-2.5 text-xs text-muted">
                {totalActive} active children across {rooms.data.length} room
                {rooms.data.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </section>

        {/* Attendance breakdown */}
        <section className="card space-y-3">
          <h2 className="font-semibold text-gray-900">Attendance Today</h2>
          {attendance.isLoading ? (
            <Spinner />
          ) : !a ? (
            <EmptyState title="No attendance data" />
          ) : (
            <>
              <div className="space-y-2.5">
                {attendanceRows.map((r) => (
                  <Bar
                    key={r.label}
                    label={r.label}
                    value={r.value}
                    max={attendanceMax}
                    color={r.color}
                    labelColor={r.text}
                  />
                ))}
              </div>
              <div className="rounded-lg bg-gray-50 p-2.5 text-center">
                <div
                  className={`text-3xl font-extrabold ${attendanceColor(
                    o?.attendanceTodayPct ?? 0,
                  )}`}
                >
                  {o ? `${o.attendanceTodayPct}%` : '—'}
                </div>
                <div className="text-xs text-muted">of expected children in today</div>
              </div>
              <div className="text-xs text-muted">{attendanceTotal} records considered</div>
            </>
          )}
        </section>
      </div>

      {/* EYFS Assessments by area */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-gray-900">EYFS Assessments by Area</h2>
        {eyfs.isLoading ? (
          <Spinner />
        ) : !eyfsRows.length ? (
          <EmptyState title="No assessments yet" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {eyfsRows.map((row) => {
                const c = eyfsColor(row.avgScore);
                const pct = Math.min((row.avgScore / eyfsMaxScore) * 100, 100);
                return (
                  <div key={row.area} className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs font-bold uppercase text-muted">{row.area}</div>
                    <div className={`mt-0.5 text-2xl font-extrabold ${c.text}`}>
                      {row.avgScore.toFixed(1)}/5
                    </div>
                    <div className="my-1.5 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full ${c.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted">
                      {row.count} assessment{row.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
            {overallEyfs && (
              <div className="border-t border-border pt-3 text-xs text-muted">
                Overall average across all EYFS areas:{' '}
                <strong className="text-gray-900">{overallEyfs}/5</strong> · {totalAssessments}{' '}
                total assessment{totalAssessments !== 1 ? 's' : ''}
                {/* TODO: needs /reports/revenue link target (Revenue Report page not in staff app) */}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
