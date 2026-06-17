import { createFileRoute } from '@tanstack/react-router';
import { useChildren } from '../features/children/useChildren';
import type { Child } from '../features/children/useChildren';
import { useAttendance, useMarkAttendance } from '../features/attendance/useAttendance';
import type { Attendance } from '../features/attendance/useAttendance';
import { Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/register')({ component: RegisterPage });

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const hhmm = (d: Date) => d.toTimeString().slice(0, 5);

type StatusKey = 'present' | 'late' | 'absent' | 'not marked';

const STATUS_VARIANT: Record<StatusKey, 'success' | 'warning' | 'danger' | 'muted'> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  'not marked': 'muted',
};

// Colored avatar initials, matching the reference app (8-colour palette by name).
const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];
const avatarColor = (name: string) =>
  AVATAR_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AVATAR_COLORS.length];
const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// Ofsted staff:child ratios by room/age-group keyword (mirrors the reference).
function ratioFor(room: string): { label: string; max: number } {
  const r = room.toLowerCase();
  if (r.includes('baby') || r.includes('under 2') || r.includes('0-2')) return { label: '1:3', max: 3 };
  if (r.includes('toddler') || r.includes('1-2') || r.includes('2-3')) return { label: '1:5', max: 5 };
  return { label: '1:8', max: 8 };
}

function statusOf(att: Attendance | undefined): StatusKey {
  if (!att || !att.status) return 'not marked';
  return att.status;
}

function RegisterPage() {
  const today = isoDate(new Date());
  const { data: children, isLoading } = useChildren();
  const { data: attendance } = useAttendance(today);
  const mark = useMarkAttendance(today);

  const active = (children ?? []).filter((c) => c.status === 'Active');
  const byChild = new Map<number, Attendance>((attendance ?? []).map((a) => [a.child_id, a]));

  const present = active.filter((c) => {
    const s = statusOf(byChild.get(c.id));
    return s === 'present' || s === 'late';
  }).length;
  const absent = active.filter((c) => statusOf(byChild.get(c.id)) === 'absent').length;

  // Group active children by room, preserving first-seen room order.
  const rooms = new Map<string, Child[]>();
  for (const c of active) {
    const room = c.room || 'Unassigned';
    if (!rooms.has(room)) rooms.set(room, []);
    rooms.get(room)!.push(c);
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="space-y-6">
          {[...rooms.entries()].map(([room, kids]) => {
            const ratio = ratioFor(room);
            const inRoom = kids.filter((c) => {
              const s = statusOf(byChild.get(c.id));
              return s === 'present' || s === 'late';
            }).length;
            const staffNeeded = Math.max(1, Math.ceil(inRoom / ratio.max));

            return (
              <section key={room} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">{room}</h2>
                  <span className="badge badge-muted">{kids.length} enrolled</span>
                  <span className="badge badge-success">{inRoom} in</span>
                  <span className="badge badge-info">
                    Ratio {ratio.label} · {staffNeeded} staff needed
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {kids.map((c) => {
                    const att = byChild.get(c.id);
                    const status = statusOf(att);
                    return (
                      <div key={c.id} className="card space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(
                                c.name,
                              )}`}
                            >
                              {initials(c.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-gray-900">{c.name}</div>
                              {c.allergy && c.allergy !== 'None' && (
                                <div className="truncate text-xs font-semibold text-danger">
                                  ⚠ {c.allergy}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                          {att?.sign_in && <span>In {att.sign_in}</span>}
                          {att?.sign_out && <span>Out {att.sign_out}</span>}
                          {att?.absent_reason && <span>Reason: {att.absent_reason}</span>}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            onClick={() => signIn(c.id)}
                            disabled={mark.isPending}
                          >
                            Sign In
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() => signOut(c.id)}
                            disabled={!att?.sign_in || mark.isPending}
                          >
                            Sign Out
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-sm ml-auto text-danger hover:text-danger"
                            onClick={() => markAbsent(c.id)}
                            disabled={mark.isPending}
                          >
                            Absent
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
