import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AccidentCreateInput, AccidentUpdateInput } from '@sprout/schemas';
import { api } from '../../api';

// Accident book row as returned by the API (snake_case from the DB).
export interface Accident {
  id: number;
  nursery_id: number;
  child_id: number | null;
  child_name: string;
  date: string;
  time: string | null;
  location: string;
  description: string;
  injury_type: string;
  body_part: string;
  first_aid_given: string;
  first_aider: string;
  witness: string;
  parent_notified_at: string | null;
  parent_notified_how: string | null;
  riddor_reportable: boolean;
  follow_up: string;
}

export const accidentBookKeys = {
  all: ['accident-book'] as const,
  list: () => [...accidentBookKeys.all, 'list'] as const,
  detail: (id: number) => [...accidentBookKeys.all, id] as const,
};

export function useAccidentBook() {
  return useQuery({
    queryKey: accidentBookKeys.list(),
    queryFn: () => api.get<Accident[]>('/accident-book'),
  });
}

export function useCreateAccident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AccidentCreateInput) => api.post<Accident>('/accident-book', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: accidentBookKeys.list() }),
  });
}

export function useUpdateAccident(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AccidentUpdateInput) => api.patch<Accident>(`/accident-book/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accidentBookKeys.list() });
      qc.invalidateQueries({ queryKey: accidentBookKeys.detail(id) });
    },
  });
}

export function useDeleteAccident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/accident-book/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: accidentBookKeys.list() }),
  });
}
