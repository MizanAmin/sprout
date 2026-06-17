import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RelativeCreateInput, RelativeUpdateInput } from '@sprout/schemas';
import { api } from '../../api';

// Relative row as returned by the API (snake_case from the DB).
export interface Relative {
  id: number;
  nursery_id: number;
  child_id: number | null;
  name: string;
  relation: string;
  phone: string;
  email: string;
  address: string;
  is_primary_contact: boolean;
  is_emergency_contact: boolean;
  has_portal_access: boolean;
}

export const relativesKeys = {
  all: ['relatives'] as const,
  list: () => [...relativesKeys.all, 'list'] as const,
  detail: (id: number) => [...relativesKeys.all, id] as const,
};

export function useRelatives() {
  return useQuery({
    queryKey: relativesKeys.list(),
    queryFn: () => api.get<Relative[]>('/relatives'),
  });
}

export function useCreateRelative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RelativeCreateInput) => api.post<Relative>('/relatives', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: relativesKeys.list() }),
  });
}

export function useUpdateRelative(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RelativeUpdateInput) => api.patch<Relative>(`/relatives/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: relativesKeys.list() });
      qc.invalidateQueries({ queryKey: relativesKeys.detail(id) });
    },
  });
}

export function useDeleteRelative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/relatives/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: relativesKeys.list() }),
  });
}
