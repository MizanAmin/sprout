import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssessmentCreateInput } from '@sprout/schemas';
import { api } from '../../api';

// Assessment row as returned by the API (snake_case from the DB).
export interface Assessment {
  id: number;
  nursery_id: number;
  child_id: number;
  area: string;
  score: number;
  notes: string;
  practitioner: string;
  assessed_at: string;
  created_at: string;
}

export interface AssessmentFilters {
  childId?: number;
}

export const assessmentKeys = {
  all: ['assessments'] as const,
  list: (f: AssessmentFilters) => [...assessmentKeys.all, 'list', f] as const,
};

function queryString(f: AssessmentFilters): string {
  const p = new URLSearchParams();
  if (f.childId) p.set('childId', String(f.childId));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useAssessments(filters: AssessmentFilters = {}) {
  return useQuery({
    queryKey: assessmentKeys.list(filters),
    queryFn: () => api.get<Assessment[]>(`/assessments${queryString(filters)}`),
    enabled: Boolean(filters.childId),
  });
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AssessmentCreateInput) => api.post<Assessment>('/assessments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: assessmentKeys.all }),
  });
}

export function useDeleteAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/assessments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: assessmentKeys.all }),
  });
}
