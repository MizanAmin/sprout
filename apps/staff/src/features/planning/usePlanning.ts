import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// Plan row as returned by the API (snake_case from the DB, planning table).
export interface Plan {
  id: number;
  nursery_id: number;
  title: string;
  day: string;
  time: string | null;
  category: string;
  room: string;
  description: string | null;
  date: string | null;
}

// Request body matches the route's zValidator schema (camelCase).
// NOTE: packages/schemas/src/plans.ts is the subscription-plan catalogue, not a
// curriculum-plan Create type, so the input type is defined inline here.
export interface PlanInput {
  title: string;
  day?: string;
  time?: string;
  category?: string;
  room?: string;
  description?: string;
  date?: string;
}

export const planningKeys = {
  all: ['planning'] as const,
  list: () => [...planningKeys.all, 'list'] as const,
  detail: (id: number) => [...planningKeys.all, id] as const,
};

export function usePlanning() {
  return useQuery({ queryKey: planningKeys.list(), queryFn: () => api.get<Plan[]>('/planning') });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PlanInput) => api.post<Plan>('/planning', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: planningKeys.list() }),
  });
}

export function useUpdatePlan(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PlanInput>) => api.patch<Plan>(`/planning/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planningKeys.list() });
      qc.invalidateQueries({ queryKey: planningKeys.detail(id) });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/planning/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: planningKeys.list() }),
  });
}
