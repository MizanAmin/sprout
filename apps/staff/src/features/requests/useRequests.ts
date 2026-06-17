import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

export type RequestStatus = 'pending' | 'approved' | 'declined';

// Booking request row as returned by the API (snake_case from the DB).
export interface BookingRequest {
  id: number;
  child_name: string;
  week_start: string;
  day: string;
  session_type: string;
  room: string;
  parent_note: string;
  status: RequestStatus;
  decided_by: string | null;
  decided_at: string | null;
}

// Holiday request row as returned by the API (snake_case from the DB).
export interface HolidayRequest {
  id: number;
  child_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: RequestStatus;
}

export const requestKeys = {
  all: ['requests'] as const,
  bookings: (status: string) => [...requestKeys.all, 'bookings', status] as const,
  holidays: (status: string) => [...requestKeys.all, 'holidays', status] as const,
};

function statusQuery(status: string): string {
  return status ? `?status=${status}` : '';
}

export function useBookingRequests(status: string) {
  return useQuery({
    queryKey: requestKeys.bookings(status),
    queryFn: () => api.get<BookingRequest[]>(`/requests/bookings${statusQuery(status)}`),
  });
}

export function useHolidayRequests(status: string) {
  return useQuery({
    queryKey: requestKeys.holidays(status),
    queryFn: () => api.get<HolidayRequest[]>(`/requests/holidays${statusQuery(status)}`),
  });
}

export function useDecideBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'declined' }) =>
      api.patch<BookingRequest>(`/requests/bookings/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: requestKeys.all }),
  });
}

export function useDecideHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'declined' }) =>
      api.patch<HolidayRequest>(`/requests/holidays/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: requestKeys.all }),
  });
}
