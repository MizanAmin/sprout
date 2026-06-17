import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// Reflection row as returned by the API (snake_case from the DB, reflections table).
export interface Reflection {
  id: number;
  nursery_id: number;
  child_id: number;
  date: string | null;
  what_went_well: string | null;
  areas_for_development: string | null;
  next_steps: string | null;
  practitioner: string | null;
}

// Request body matches the route's zValidator schema (camelCase).
export interface ReflectionInput {
  childId: number;
  date?: string;
  whatWentWell?: string;
  areasForDevelopment?: string;
  nextSteps?: string;
  practitioner?: string;
}

export const reflectionsKeys = {
  all: ['reflections'] as const,
  list: () => [...reflectionsKeys.all, 'list'] as const,
  detail: (id: number) => [...reflectionsKeys.all, id] as const,
};

export function useReflections() {
  return useQuery({
    queryKey: reflectionsKeys.list(),
    queryFn: () => api.get<Reflection[]>('/reflections'),
  });
}

export function useCreateReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ReflectionInput) => api.post<Reflection>('/reflections', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: reflectionsKeys.list() }),
  });
}

export function useUpdateReflection(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ReflectionInput>) => api.patch<Reflection>(`/reflections/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reflectionsKeys.list() });
      qc.invalidateQueries({ queryKey: reflectionsKeys.detail(id) });
    },
  });
}

export function useDeleteReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/reflections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: reflectionsKeys.list() }),
  });
}
