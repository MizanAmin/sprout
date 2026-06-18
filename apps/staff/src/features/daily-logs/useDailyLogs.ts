import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DailyLogCreateInput, DailyLogUpdateInput } from '@sprout/schemas';
import { api } from '../../api';

// Daily log row as returned by the API (snake_case from the DB).
export interface DailyLog {
  id: number;
  nursery_id: number;
  child_id: number;
  date: string;
  time: string | null;
  type: 'meal' | 'sleep' | 'nappy' | 'mood' | 'activity' | 'note';
  details: string;
  added_by: string;
  is_shared: boolean;
  created_at: string;
}

export interface DailyLogFilters {
  childId?: number;
  date?: string;
}

export const dailyLogKeys = {
  all: ['daily-logs'] as const,
  list: (f: DailyLogFilters) => [...dailyLogKeys.all, 'list', f] as const,
};

function queryString(f: DailyLogFilters): string {
  const p = new URLSearchParams();
  if (f.childId) p.set('childId', String(f.childId));
  if (f.date) p.set('date', f.date);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useDailyLogs(filters: DailyLogFilters = {}) {
  return useQuery({
    queryKey: dailyLogKeys.list(filters),
    queryFn: () => api.get<DailyLog[]>(`/daily-logs${queryString(filters)}`),
    enabled: Boolean(filters.childId),
  });
}

export function useCreateDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DailyLogCreateInput) => api.post<DailyLog>('/daily-logs', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dailyLogKeys.all }),
  });
}

export function useUpdateDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DailyLogUpdateInput }) =>
      api.patch<DailyLog>(`/daily-logs/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dailyLogKeys.all }),
  });
}

export function useDeleteDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/daily-logs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: dailyLogKeys.all }),
  });
}
