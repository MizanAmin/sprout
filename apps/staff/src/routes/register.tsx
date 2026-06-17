import { createFileRoute } from '@tanstack/react-router';
import { useChildren } from '../features/children/useChildren';
import { useAttendance, useMarkAttendance } from '../features/attendance/useAttendance';
import { Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/register')({ component: RegisterPage });

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const hhmm = (d: Date) => d.toTimeString().slice(0, 5);

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  'not marked': 'muted',
};

function RegisterPage() {
  const today = isoDate(new Date());
  const { data: children, isLoading } = useChildren();
  const { data: attendance } = useAttendance(today);
  const mark = useMarkAttendance(today);

  const active = (children ?? []).filter((c) => c.status === 'Active');
  const byChild = new Map((attendance ?? []).map((a) => [a.child_id, a]));

  const present = (attendance ?? []).filter((a) => a.status === 'present' || a.status === 'late').length;
  const absent = (attendance ?? []).filter((a) => a.status === 'absent').length;

  const signIn = (childId: number) =>
    mark.mutate({ childId, date: today, status: 'present', signIn: hhmm(new Date()) });
  const signOut = (childId: number) =>
    mark.mutate({ childId, date: today, signOut: hhmm(new Date()) });
  const markAbsent = (childId: number) => {
    const absentReason = prompt('Reason for absence?');
    if (absentReason == null) return;
    mark.mutate({ childId, date: today, status: 'absent', absentReason });
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Live Register</h1>
        <div className="flex gap-2">
          <Badge variant="success">Present {present}</Badge>
          <Badge variant="info">Expected {active.length}</Badge>
          <Badge variant="danger">Absent {absent}</Badge>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : active.length === 0 ? (
        <EmptyState title="No active children" description="Add a child to start taking the register." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((c) => {
            const att = byChild.get(c.id);
            const status = att?.status ?? 'not marked';
            return (
              <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-muted">{c.room || '—'}</div>
                  </div>
                  <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                </div>
                <div className="mt-2 text-xs text-muted">
                  {att?.sign_in && <span className="mr-3">In {att.sign_in}</span>}
                  {att?.sign_out && <span className="mr-3">Out {att.sign_out}</span>}
                  {att?.absent_reason && <span>Reason: {att.absent_reason}</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary text-sm" onClick={() => signIn(c.id)}>
                    Sign In
                  </button>
                  <button
                    className="text-sm text-primary"
                    onClick={() => signOut(c.id)}
                    disabled={!att?.sign_in}
                  >
                    Sign Out
                  </button>
                  <button className="ml-auto text-sm text-danger" onClick={() => markAbsent(c.id)}>
                    Absent
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
