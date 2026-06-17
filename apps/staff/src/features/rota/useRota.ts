import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// Rota row as returned by the API (snake_case from the DB).
export interface RotaRow {
  id: number;
  nursery_id: number;
  staff_name: string;
  week_start: string;
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
  created_at: string;
}

export interface RotaUpsertInput {
  staffName: string;
  weekStart: string;
  mon?: string;
  tue?: string;
  wed?: string;
  thu?: string;
  fri?: string;
  sat?: string;
  sun?: string;
}

export const rotaKeys = {
  all: ['rota'] as const,
  list: (weekStart: string) => [...rotaKeys.all, 'list', weekStart] as const,
};

export function useRota(weekStart: string) {
  return useQuery({
    queryKey: rotaKeys.list(weekStart),
    queryFn: () => api.get<RotaRow[]>(`/rota?weekStart=${weekStart}`),
    enabled: !!weekStart,
  });
}

export function useUpsertRota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RotaUpsertInput) => api.post<RotaRow>('/rota', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: rotaKeys.all }),
  });
}

export function useDeleteRota() {
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
