import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// A single rota shift (rota_shifts table) — snake_case from the API.
export interface RotaShift {
  id: number;
  nursery_id: number;
  staff_id: number;
  staff_name: string;
  date: string; // YYYY-MM-DD
  type: 'work' | 'holiday' | 'sick' | 'training' | 'off';
  start_time: string | null;
  end_time: string | null;
  room: string;
  notes: string;
  created_at: string;
}

export interface ShiftInput {
  staffId: number;
  staffName: string;
  date: string;
  type?: RotaShift['type'];
  startTime?: string;
  endTime?: string;
  room?: string;
  notes?: string;
}

export const rotaKeys = {
  all: ['rota'] as const,
  list: (weekStart: string) => [...rotaKeys.all, 'list', weekStart] as const,
};

export function useRota(weekStart: string) {
  return useQuery({
    queryKey: rotaKeys.list(weekStart),
    queryFn: () => api.get<RotaShift[]>(`/rota?weekStart=${weekStart}`),
    enabled: !!weekStart,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ShiftInput) => api.post<RotaShift>('/rota', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: rotaKeys.all }),
  });
}

export function useUpdateShift(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ShiftInput>) => api.patch<RotaShift>(`/rota/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: rotaKeys.all }),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/rota/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: rotaKeys.all }),
  });
}

// Monday (ISO date) of the week containing the given date.
export function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday → previous Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Add/subtract whole weeks from an ISO Monday date, returning an ISO date.
export function addWeeks(weekStart: string, weeks: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

// The seven ISO dates (Mon–Sun) of the week starting at `weekStart`.
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
