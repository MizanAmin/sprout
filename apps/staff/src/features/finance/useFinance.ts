import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

export interface FinanceSummary {
  collected: number;
  pending: number;
  overdue: number;
  collectionRate: number;
}

export interface OverdueRow {
  id: number;
  child_name: string;
  invoice_ref: string;
  outstanding: number;
  due_date: string | null;
  reminder_count: number;
}

export const financeKeys = {
  all: ['finance'] as const,
  summary: () => [...financeKeys.all, 'summary'] as const,
  overdue: () => [...financeKeys.all, 'overdue'] as const,
};

export function useFinanceSummary() {
  return useQuery({
    queryKey: financeKeys.summary(),
    queryFn: () => api.get<FinanceSummary>('/finance/summary'),
  });
}

export function useOverdue() {
  return useQuery({
    queryKey: financeKeys.overdue(),
    queryFn: () => api.get<OverdueRow[]>('/finance/overdue'),
  });
}

export function useSendReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<{ ok: true }>(`/invoices/${id}/send-reminder`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.overdue() }),
  });
}
