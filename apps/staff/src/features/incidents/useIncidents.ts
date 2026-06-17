import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { IncidentCreateInput, IncidentUpdateInput } from '@sprout/schemas';
import { api } from '../../api';

// Incident row as returned by the API (snake_case from the DB).
export interface Incident {
  id: number;
  nursery_id: number;
  child_id: number | null;
  child_name: string;
  date: string;
  time: string | null;
  type: string;
  location: string;
  description: string;
  action_taken: string;
  witness: string;
  reported_by: string;
  parent_informed: boolean;
  parent_informed_at: string | null;
  signed_by: string;
}

export const incidentsKeys = {
  all: ['incidents'] as const,
  list: () => [...incidentsKeys.all, 'list'] as const,
  detail: (id: number) => [...incidentsKeys.all, id] as const,
};

export function useIncidents() {
  return useQuery({
    queryKey: incidentsKeys.list(),
    queryFn: () => api.get<Incident[]>('/incidents'),
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: IncidentCreateInput) => api.post<Incident>('/incidents', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: incidentsKeys.list() }),
  });
}

export function useUpdateIncident(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: IncidentUpdateInput) => api.patch<Incident>(`/incidents/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: incidentsKeys.list() });
      qc.invalidateQueries({ queryKey: incidentsKeys.detail(id) });
    },
  });
}

export function useDeleteIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/incidents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: incidentsKeys.list() }),
  });
}
