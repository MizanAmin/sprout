import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// fire_drills row as returned by the API (snake_case from the DB).
export interface FireDrill {
  id: number;
  nursery_id: number;
  date: string;
  time: string | null;
  drill_type: string;
  evacuation_time: string | null;
  persons_present: number | null;
  all_clear: boolean;
  issues: string;
  conducted_by: string;
  notes: string;
  created_at: string;
}

// POST/PATCH body (camelCase), mirrors the route's zod schema.
export interface FireDrillInput {
  date: string;
  time?: string;
  drillType?: string;
  evacuationTime?: string;
  personsPresent?: number;
  allClear?: boolean;
  issues?: string;
  conductedBy?: string;
  notes?: string;
}

export const fireDrillKeys = {
  all: ['fire-register'] as const,
  list: () => [...fireDrillKeys.all, 'list'] as const,
};

export function useFireDrills() {
  return useQuery({
    queryKey: fireDrillKeys.list(),
    queryFn: () => api.get<FireDrill[]>('/fire-register'),
  });
}

export function useCreateFireDrill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FireDrillInput) => api.post<FireDrill>('/fire-register', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: fireDrillKeys.list() }),
  });
}

export function useUpdateFireDrill(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FireDrillInput>) => api.patch<FireDrill>(`/fire-register/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: fireDrillKeys.list() }),
  });
}

export function useDeleteFireDrill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/fire-register/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: fireDrillKeys.list() }),
  });
}
