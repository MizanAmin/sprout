import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

export type SendStatus = 'active' | 'monitoring' | 'resolved';

// SEND flag row as returned by the API (snake_case from the DB, send_flags table).
export interface SendFlag {
  id: number;
  nursery_id: number;
  child_id: number;
  category: string;
  details: string | null;
  support_plan: string | null;
  review_date: string | null;
  flagged_by: string | null;
  status: SendStatus;
}

// Request body matches the route's zValidator schema (camelCase).
export interface SendInput {
  childId: number;
  category: string;
  details?: string;
  supportPlan?: string;
  reviewDate?: string;
  flaggedBy?: string;
  status?: SendStatus;
}

export const sendKeys = {
  all: ['send'] as const,
  list: () => [...sendKeys.all, 'list'] as const,
  detail: (id: number) => [...sendKeys.all, id] as const,
};

export function useSend() {
  return useQuery({ queryKey: sendKeys.list(), queryFn: () => api.get<SendFlag[]>('/send') });
}

export function useCreateSend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SendInput) => api.post<SendFlag>('/send', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sendKeys.list() }),
  });
}

export function useUpdateSend(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SendInput>) => api.patch<SendFlag>(`/send/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sendKeys.list() });
      qc.invalidateQueries({ queryKey: sendKeys.detail(id) });
    },
  });
}

export function useDeleteSend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/send/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: sendKeys.list() }),
  });
}
