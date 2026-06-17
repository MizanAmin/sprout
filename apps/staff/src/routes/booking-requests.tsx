import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useBookingRequests,
  useHolidayRequests,
  useDecideBooking,
  useDecideHoliday,
  type RequestStatus,
} from '../features/requests/useRequests';
import { Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/booking-requests')({
  component: BookingRequestsPage,
});

type Tab = 'bookings' | 'holidays';

const STATUS_VARIANT: Record<RequestStatus, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  declined: 'danger',
};

function BookingRequestsPage() {
  const [tab, setTab] = useState<Tab>('bookings');
  const [status, setStatus] = useState('');

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Booking Requests</h1>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          <TabButton active={tab === 'bookings'} onClick={() => setTab('bookings')}>
            Bookings
          </TabButton>
          <TabButton active={tab === 'holidays'} onClick={() => setTab('holidays')}>
            Holiday requests
          </TabButton>
        </div>
        <select
          className="input max-w-[12rem]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {tab === 'bookings' ? (
        <BookingsTable status={status} />
      ) : (
        <HolidaysTable status={status} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function BookingsTable({ status }: { status: string }) {
  const { data: rows, isLoading } = useBookingRequests(status);
  const decide = useDecideBooking();

  if (isLoading) return <Spinner />;
  if ((rows ?? []).length === 0)
    return <EmptyState title="No booking requests" description="Requests will appear here." />;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Child</th>
            <th className="px-4 py-2 font-medium">Week</th>
            <th className="px-4 py-2 font-medium">Day</th>
            <th className="px-4 py-2 font-medium">Session</th>
            <th className="px-4 py-2 font-medium">Room</th>
            <th className="px-4 py-2 font-medium">Note</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(rows ?? []).map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-2">{r.child_name}</td>
              <td className="px-4 py-2">{r.week_start}</td>
              <td className="px-4 py-2">{r.day}</td>
              <td className="px-4 py-2">{r.session_type}</td>
              <td className="px-4 py-2">{r.room || '—'}</td>
              <td className="px-4 py-2 text-muted">{r.parent_note || '—'}</td>
              <td className="px-4 py-2">
                <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
              </td>
              <td className="px-4 py-2 text-right">
                {r.status === 'pending' ? (
                  <>
                    <button
                      className="text-sm text-success"
                      onClick={() => decide.mutate({ id: r.id, status: 'approved' })}
                    >
                      Approve
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => decide.mutate({ id: r.id, status: 'declined' })}
                    >
                      Decline
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted">{r.decided_by ?? ''}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HolidaysTable({ status }: { status: string }) {
  const { data: rows, isLoading } = useHolidayRequests(status);
  const decide = useDecideHoliday();

  if (isLoading) return <Spinner />;
  if ((rows ?? []).length === 0)
    return <EmptyState title="No holiday requests" description="Requests will appear here." />;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Child</th>
            <th className="px-4 py-2 font-medium">From</th>
            <th className="px-4 py-2 font-medium">To</th>
            <th className="px-4 py-2 font-medium">Reason</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(rows ?? []).map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-2">{r.child_name}</td>
              <td className="px-4 py-2">{r.start_date}</td>
              <td className="px-4 py-2">{r.end_date}</td>
              <td className="px-4 py-2 text-muted">{r.reason || '—'}</td>
              <td className="px-4 py-2">
                <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
              </td>
              <td className="px-4 py-2 text-right">
                {r.status === 'pending' ? (
                  <>
                    <button
                      className="text-sm text-success"
                      onClick={() => decide.mutate({ id: r.id, status: 'approved' })}
                    >
                      Approve
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => decide.mutate({ id: r.id, status: 'declined' })}
                    >
                      Decline
                    </button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
