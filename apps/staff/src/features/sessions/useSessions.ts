import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SessionCreateInput } from '@sprout/schemas';
import { api } from '../../api';

// Child session row as returned by the API (snake_case from child_sessions).
// NOTE: the route is mounted at '/child-sessions', though the page path is '/sessions'.
export interface ChildSession {
  id: number;
  nursery_id: number;
  child_id: number;
  day: string;
  session_type: string;
  start_time: string | null;
  end_time: string | null;
  funded_hours: number;
  fee_hours: number;
  room: string;
  start_date: string;
  end_date: string | null;
  notes: string;
}

export const sessionsKeys = {
  all: ['child-sessions'] as const,
  list: () => [...sessionsKeys.all, 'list'] as const,
  detail: (id: number) => [...sessionsKeys.all, id] as const,
};

export function useSessions() {
  return useQuery({
    queryKey: sessionsKeys.list(),
    queryFn: () => api.get<ChildSession[]>('/child-sessions'),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SessionCreateInput) => api.post<ChildSession>('/child-sessions', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionsKeys.list() }),
  });
}

export function useUpdateSession(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SessionCreateInput) => api.patch<ChildSession>(`/child-sessions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionsKeys.list() });
      qc.invalidateQueries({ queryKey: sessionsKeys.detail(id) });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/child-sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionsKeys.list() }),
  });
}
