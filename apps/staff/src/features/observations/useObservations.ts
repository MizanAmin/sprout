import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ObservationCreateInput } from '@sprout/schemas';
import { api } from '../../api';

// Observation row as returned by the API (snake_case from the DB).
export interface Observation {
  id: number;
  nursery_id: number;
  child_id: number;
  child_name: string;
  obs_date: string;
  areas: string[];
  text: string;
  photo_url: string;
  is_shared: boolean;
  practitioner: string;
  score: number | null;
  created_at: string;
}

export interface ObservationFilters {
  childId?: number;
}

export const observationKeys = {
  all: ['observations'] as const,
  list: (f: ObservationFilters) => [...observationKeys.all, 'list', f] as const,
};

function queryString(f: ObservationFilters): string {
  const p = new URLSearchParams();
  if (f.childId) p.set('childId', String(f.childId));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useObservations(filters: ObservationFilters = {}) {
  return useQuery({
    queryKey: observationKeys.list(filters),
    queryFn: () => api.get<Observation[]>(`/observations${queryString(filters)}`),
  });
}

export function useCreateObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ObservationCreateInput) => api.post<Observation>('/observations', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: observationKeys.all }),
  });
}

export function useDeleteObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/observations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: observationKeys.all }),
  });
}
