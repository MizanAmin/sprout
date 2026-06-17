import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../api';

// No shared @sprout/schemas for compliance — define inline.

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------
export const policyCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().optional(),
  content: z.string().optional(),
  version: z.string().default('1.0'),
  reviewedAt: z.string().optional(),
  nextReview: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
});

export type PolicyCreateInput = z.infer<typeof policyCreateSchema>;

// Policy row as returned by the API (snake_case from the DB).
export interface Policy {
  id: number;
  nursery_id: number;
  title: string;
  category: string;
  content: string;
  version: string;
  reviewed_at: string | null;
  next_review: string | null;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
}

export const policyKeys = {
  all: ['policies'] as const,
  list: () => [...policyKeys.all, 'list'] as const,
};

export function usePolicies() {
  return useQuery({ queryKey: policyKeys.list(), queryFn: () => api.get<Policy[]>('/compliance/policies') });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PolicyCreateInput) => api.post<Policy>('/compliance/policies', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: policyKeys.all }),
  });
}

export function useUpdatePolicy(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PolicyCreateInput) => api.patch<Policy>(`/compliance/policies/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: policyKeys.all }),
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/compliance/policies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: policyKeys.all }),
  });
}

// ---------------------------------------------------------------------------
// Risk assessments
// ---------------------------------------------------------------------------
export const riskAssessmentCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  location: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewDate: z.string().optional(),
  nextReview: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
});

export type RiskAssessmentCreateInput = z.infer<typeof riskAssessmentCreateSchema>;

// Risk assessment row as returned by the API (snake_case from the DB).
export interface RiskAssessment {
  id: number;
  nursery_id: number;
  title: string;
  location: string;
  reviewed_by: string;
  review_date: string | null;
  next_review: string | null;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
}

export const riskAssessmentKeys = {
  all: ['risk-assessments'] as const,
  list: () => [...riskAssessmentKeys.all, 'list'] as const,
};

export function useRiskAssessments() {
  return useQuery({
    queryKey: riskAssessmentKeys.list(),
    queryFn: () => api.get<RiskAssessment[]>('/compliance/risk-assessments'),
  });
}

export function useCreateRiskAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RiskAssessmentCreateInput) =>
      api.post<RiskAssessment>('/compliance/risk-assessments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskAssessmentKeys.all }),
  });
}

export function useUpdateRiskAssessment(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RiskAssessmentCreateInput) =>
      api.patch<RiskAssessment>(`/compliance/risk-assessments/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskAssessmentKeys.all }),
  });
}

export function useDeleteRiskAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/compliance/risk-assessments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskAssessmentKeys.all }),
  });
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------
export const trainingCreateSchema = z.object({
  staffName: z.string().optional(),
  courseName: z.string().min(1, 'Course name is required'),
  provider: z.string().optional(),
  completedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  certificateUrl: z.string().optional(),
  status: z.enum(['planned', 'completed', 'expired']).default('completed'),
});

export type TrainingCreateInput = z.infer<typeof trainingCreateSchema>;

// Training row as returned by the API (snake_case from the DB).
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
  created_at: string;
}

export interface TrainingFilters {
  expiringSoon?: boolean;
}

export const trainingKeys = {
  all: ['training'] as const,
  list: (f: TrainingFilters) => [...trainingKeys.all, 'list', f] as const,
};

function trainingQueryString(f: TrainingFilters): string {
  const p = new URLSearchParams();
  if (f.expiringSoon) p.set('expiringSoon', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useTraining(filters: TrainingFilters = {}) {
  return useQuery({
    queryKey: trainingKeys.list(filters),
    queryFn: () => api.get<Training[]>(`/staff-dev/training${trainingQueryString(filters)}`),
  });
}

export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TrainingCreateInput) => api.post<Training>('/staff-dev/training', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.all }),
  });
}

export function useUpdateTraining(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TrainingCreateInput) => api.patch<Training>(`/staff-dev/training/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.all }),
  });
}

export function useDeleteTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/staff-dev/training/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.all }),
  });
}

// True when an ISO date string is strictly before today.
export function isPast(date: string | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date(new Date().toDateString());
}
