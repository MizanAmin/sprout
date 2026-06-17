import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// Daily check mark = a row in daily_logs (snake_case from the DB).
export interface DailyLog {
  id: number;
  nursery_id: number;
  child_id: number;
  date: string;
  time: string | null;
  type: 'meal' | 'sleep' | 'nappy' | 'mood' | 'activity' | 'note';
  details: string | null;
  added_by: string;
}

// POST body (camelCase, matches the inline zod schema in the API route).
export interface MarkCreateInput {
  childId: number;
  type: DailyLog['type'];
  details?: string;
  time?: string;
  // Optional YYYY-MM-DD; defaults to today server-side when omitted.
  date?: string;
}

export const monitoringKeys = {
  all: ['monitoring'] as const,
  list: (date: string) => [...monitoringKeys.all, 'list', date] as const,
};

export function useMonitoring(date: string) {
  return useQuery({
    queryKey: monitoringKeys.list(date),
    queryFn: () => api.get<DailyLog[]>(`/monitoring?date=${date}`),
  });
}

export function useCreateMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MarkCreateInput) => api.post<DailyLog>('/monitoring', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: monitoringKeys.all }),
  });
}

export function useDeleteMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/monitoring/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: monitoringKeys.all }),
  });
}
