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
  hours: number | null;
  training_type: string;
  notes: string;
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
  hours?: number;
  trainingType?: string;
  notes?: string;
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
  period: string;
  overall_rating: string;
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
  period?: string;
  overallRating?: string;
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

// ---- Qualifications ----

// Qualification row (snake_case from the DB).
export interface Qualification {
  id: number;
  nursery_id: number;
  staff_id: number | null;
  staff_name: string;
  qualification: string;
  awarding_body: string;
  date_achieved: string | null;
  expiry_date: string | null;
  level: string;
  certificate_url: string;
  created_at: string;
}

// POST/PATCH body (camelCase, matches the API inline zod schema).
export interface QualificationInput {
  staffId?: number;
  staffName?: string;
  qualification: string;
  awardingBody?: string;
  dateAchieved?: string;
  expiryDate?: string;
  level?: string;
  certificateUrl?: string;
}

export const qualificationsKeys = {
  all: ['staff-dev', 'qualifications'] as const,
  list: () => [...qualificationsKeys.all, 'list'] as const,
};

export function useQualifications() {
  return useQuery({
    queryKey: qualificationsKeys.list(),
    queryFn: () => api.get<Qualification[]>('/staff-dev/qualifications'),
  });
}

export function useCreateQualification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QualificationInput) =>
      api.post<Qualification>('/staff-dev/qualifications', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qualificationsKeys.list() }),
  });
}

export function useUpdateQualification(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<QualificationInput>) =>
      api.patch<Qualification>(`/staff-dev/qualifications/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qualificationsKeys.list() }),
  });
}

export function useDeleteQualification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/staff-dev/qualifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qualificationsKeys.list() }),
  });
}

// ---- Wellbeing check-ins ----

// Wellbeing check-in row (snake_case from the DB).
export interface Wellbeing {
  id: number;
  nursery_id: number;
  staff_id: number | null;
  staff_name: string;
  date: string;
  mood: number;
  workload: number;
  support: number;
  notes: string;
  created_at: string;
}

// POST/PATCH body (camelCase, matches the API inline zod schema).
export interface WellbeingInput {
  staffId?: number;
  staffName?: string;
  date?: string;
  mood: number;
  workload: number;
  support: number;
  notes?: string;
}

export const wellbeingKeys = {
  all: ['staff-dev', 'wellbeing'] as const,
  list: () => [...wellbeingKeys.all, 'list'] as const,
};

export function useWellbeing() {
  return useQuery({
    queryKey: wellbeingKeys.list(),
    queryFn: () => api.get<Wellbeing[]>('/staff-dev/wellbeing'),
  });
}

export function useCreateWellbeing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WellbeingInput) => api.post<Wellbeing>('/staff-dev/wellbeing', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: wellbeingKeys.list() }),
  });
}

export function useUpdateWellbeing(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<WellbeingInput>) =>
      api.patch<Wellbeing>(`/staff-dev/wellbeing/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: wellbeingKeys.list() }),
  });
}

export function useDeleteWellbeing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/staff-dev/wellbeing/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: wellbeingKeys.list() }),
  });
}
