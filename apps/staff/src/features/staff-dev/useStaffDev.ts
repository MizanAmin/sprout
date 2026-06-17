import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// ---- Training ----

// Training row (snake_case from the DB).
export interface Training {
  id: number;
  nursery_id: number;
  staff_id: number | null;
  staff_name: string;
  course_name: string;
  provider: string;
  completed_date: string | null;
  expiry_date: string | null;
  certificate_url: string;
  status: 'planned' | 'completed' | 'expired';
}

// POST/PATCH body (camelCase, matches the API inline zod schema).
export interface TrainingInput {
  staffId?: number;
  staffName?: string;
  courseName: string;
  provider?: string;
  completedDate?: string;
  expiryDate?: string;
  certificateUrl?: string;
  status?: 'planned' | 'completed' | 'expired';
}

export const trainingKeys = {
  all: ['staff-dev', 'training'] as const,
  list: () => [...trainingKeys.all, 'list'] as const,
};

export function useTraining() {
  return useQuery({
    queryKey: trainingKeys.list(),
    queryFn: () => api.get<Training[]>('/staff-dev/training'),
  });
}

export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TrainingInput) => api.post<Training>('/staff-dev/training', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.list() }),
  });
}

export function useUpdateTraining(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TrainingInput>) =>
      api.patch<Training>(`/staff-dev/training/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.list() }),
  });
}

export function useDeleteTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/staff-dev/training/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.list() }),
  });
}

// ---- Appraisals ----

// Appraisal row (snake_case from the DB).
export interface Appraisal {
  id: number;
  nursery_id: number;
  staff_id: number | null;
  staff_name: string;
  date: string;
  appraiser: string;
  strengths: string;
  areas_for_dev: string;
  targets: string;
  next_review: string | null;
}

// POST/PATCH body (camelCase, matches the API inline zod schema).
export interface AppraisalInput {
  staffId?: number;
  staffName?: string;
  date?: string;
  appraiser?: string;
  strengths?: string;
  areasForDev?: string;
  targets?: string;
  nextReview?: string;
}

export const appraisalsKeys = {
  all: ['staff-dev', 'appraisals'] as const,
  list: () => [...appraisalsKeys.all, 'list'] as const,
};

export function useAppraisals() {
  return useQuery({
    queryKey: appraisalsKeys.list(),
    queryFn: () => api.get<Appraisal[]>('/staff-dev/appraisals'),
  });
}

export function useCreateAppraisal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppraisalInput) => api.post<Appraisal>('/staff-dev/appraisals', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: appraisalsKeys.list() }),
  });
}

export function useUpdateAppraisal(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AppraisalInput>) =>
      api.patch<Appraisal>(`/staff-dev/appraisals/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: appraisalsKeys.list() }),
  });
}

export function useDeleteAppraisal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/staff-dev/appraisals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: appraisalsKeys.list() }),
  });
}
