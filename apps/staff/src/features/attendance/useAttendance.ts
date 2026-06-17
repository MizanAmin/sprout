import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// Attendance row as returned by the API (snake_case from the DB).
export interface Attendance {
  id: number;
  nursery_id: number;
  child_id: number;
  date: string;
  status: 'present' | 'absent' | 'late' | null;
  sign_in: string | null;
  sign_out: string | null;
  absent_reason: string | null;
  signed_in_by: string | null;
  collected_by: string | null;
  att_notes: string | null;
  created_at: string;
}

export const attendanceKeys = {
  all: ['attendance'] as const,
  byDate: (date: string) => [...attendanceKeys.all, date] as const,
};

export function useAttendance(date: string) {
  return useQuery({
    queryKey: attendanceKeys.byDate(date),
    queryFn: () => api.get<Attendance[]>(`/attendance?date=${date}`),
  });
}

// Single mutation for sign-in / sign-out / absent; the server upserts on
// child_id + date. Invalidates that day's attendance on success.
export function useMarkAttendance(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Attendance>('/attendance', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.byDate(date) }),
  });
}
