import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { StatCard, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
});

interface Overview {
  attendanceTodayPct: number;
  activeChildren: number;
  activities30d: number;
  avgEyfsScore: number;
}
interface AttendanceBreakdown {
  present: number;
  absent: number;
  late: number;
  notMarked: number;
}
interface RoomCount {
  room: string;
  count: number;
}
interface EyfsArea {
  area: string;
  avgScore: number;
  count: number;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 4) return 'bg-success-light text-success';
  if (score >= 3) return 'bg-warning-light text-warning';
  return 'bg-danger-light text-danger';
}

function ReportsPage() {
  const today = isoDate(new Date());

  const overview = useQuery({
    queryKey: ['reports', 'overview'],
    queryFn: () => api.get<Overview>('/reports/overview'),
  });
  const attendance = useQuery({
    queryKey: ['reports', 'attendance-breakdown', today],
    queryFn: () =>
      api.get<AttendanceBreakdown>(`/reports/attendance-breakdown?date=${today}`),
  });
  const rooms = useQuery({
    queryKey: ['reports', 'children-by-room'],
    queryFn: () => api.get<RoomCount[]>('/reports/children-by-room'),
  });
  const eyfs = useQuery({
    queryKey: ['reports', 'eyfs-by-area'],
    queryFn: () => api.get<EyfsArea[]>('/reports/eyfs-by-area'),
  });

  const a = attendance.data;
  const attendanceRows = a
    ? [
        { label: 'Present', value: a.present },
        { label: 'Absent', value: a.absent },
        { label: 'Late', value: a.late },
        { label: 'Not marked', value: a.notMarked },
      ]
    : [];
  const attendanceMax = Math.max(1, ...attendanceRows.map((r) => r.value));
  const roomsMax = Math.max(1, ...(rooms.data ?? []).map((r) => r.count));

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Attendance Today"
          value={overview.data ? `${overview.data.attendanceTodayPct}%` : '—'}
        />
        <StatCard label="Active Children" value={overview.data?.activeChildren ?? '—'} />
        <StatCard label="Activities (30 days)" value={overview.data?.activities30d ?? '—'} />
        <StatCard
          label="Avg EYFS Score"
          value={overview.data ? overview.data.avgEyfsScore.toFixed(1) : '—'}
        />
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Attendance breakdown (today)</h2>
        {attendance.isLoading ? (
          <Spinner />
        ) : !a ? (
          <EmptyState title="No attendance data" />
        ) : (
          <div className="space-y-3">
            {attendanceRows.map((r) => (
              <Bar key={r.label} label={r.label} value={r.value} max={attendanceMax} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Children by room</h2>
        {rooms.isLoading ? (
          <Spinner />
        ) : !rooms.data?.length ? (
          <EmptyState title="No rooms" />
        ) : (
          <div className="space-y-3">
            {rooms.data.map((r) => (
              <Bar key={r.room} label={r.room} value={r.count} max={roomsMax} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold text-gray-900">EYFS by area</h2>
        {eyfs.isLoading ? (
          <Spinner />
        ) : !eyfs.data?.length ? (
          <EmptyState title="No EYFS data" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Area</th>
                <th className="px-4 py-2 font-medium">Avg score</th>
                <th className="px-4 py-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {eyfs.data.map((row) => (
                <tr key={row.area} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{row.area}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor(
                        row.avgScore,
                      )}`}
                    >
                      {row.avgScore.toFixed(1)} / 5
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
