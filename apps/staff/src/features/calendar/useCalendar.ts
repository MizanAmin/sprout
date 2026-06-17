import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// Calendar event row as returned by the API (snake_case from calendar_events).
export interface CalendarEvent {
  id: number;
  nursery_id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  color: string;
  event_type: string;
  description: string | null;
  created_by: string | null;
}

// Mirrors the route's inline createSchema (camelCase).
export interface CalendarEventInput {
  title: string;
  startDate: string;
  endDate?: string;
  allDay?: boolean;
  color?: string;
  eventType?: string;
  description?: string;
  createdBy?: string;
}

export const calendarKeys = {
  all: ['calendar'] as const,
  list: () => [...calendarKeys.all, 'list'] as const,
  detail: (id: number) => [...calendarKeys.all, id] as const,
};

export function useCalendarEvents() {
  return useQuery({
    queryKey: calendarKeys.list(),
    queryFn: () => api.get<CalendarEvent[]>('/calendar'),
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CalendarEventInput) => api.post<CalendarEvent>('/calendar', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: calendarKeys.list() }),
  });
}

export function useUpdateCalendarEvent(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CalendarEventInput) => api.patch<CalendarEvent>(`/calendar/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.list() });
      qc.invalidateQueries({ queryKey: calendarKeys.detail(id) });
    },
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/calendar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: calendarKeys.list() }),
  });
}
