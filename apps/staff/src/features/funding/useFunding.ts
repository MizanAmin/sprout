import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// ---- Periods ----

// Funding period row (snake_case from the DB).
export interface FundingPeriod {
  id: number;
  nursery_id: number;
  label: string;
  start_date: string;
  end_date: string;
}

// POST/PATCH body (camelCase, matches the API inline zod schema).
export interface PeriodInput {
  label: string;
  startDate: string;
  endDate: string;
}

export const periodsKeys = {
  all: ['funding', 'periods'] as const,
  list: () => [...periodsKeys.all, 'list'] as const,
};

export function usePeriods() {
  return useQuery({
    queryKey: periodsKeys.list(),
    queryFn: () => api.get<FundingPeriod[]>('/funding/periods'),
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PeriodInput) => api.post<FundingPeriod>('/funding/periods', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: periodsKeys.list() }),
  });
}

export function useUpdatePeriod(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PeriodInput>) =>
      api.patch<FundingPeriod>(`/funding/periods/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: periodsKeys.list() }),
  });
}

export function useDeletePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/funding/periods/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: periodsKeys.list() }),
  });
}

// ---- Claims ----

// Funding claim row (snake_case from the DB).
export interface FundingClaim {
  id: number;
  nursery_id: number;
  funding_period_id: number;
  child_id: number | null;
  child_name: string;
  claimed_hours: number;
  expected_hours: number;
  status: string;
}

// POST/PATCH body (camelCase, matches the API inline zod schema).
export interface ClaimInput {
  fundingPeriodId: number;
  childId?: number;
  childName?: string;
  claimedHours?: number;
  expectedHours?: number;
  status?: string;
}

export const claimsKeys = {
  all: ['funding', 'claims'] as const,
  list: () => [...claimsKeys.all, 'list'] as const,
};

export function useClaims() {
  return useQuery({
    queryKey: claimsKeys.list(),
    queryFn: () => api.get<FundingClaim[]>('/funding/claims'),
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ClaimInput) => api.post<FundingClaim>('/funding/claims', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: claimsKeys.list() }),
  });
}

export function useUpdateClaim(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ClaimInput>) => api.patch<FundingClaim>(`/funding/claims/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: claimsKeys.list() }),
  });
}

export function useDeleteClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/funding/claims/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: claimsKeys.list() }),
  });
}
