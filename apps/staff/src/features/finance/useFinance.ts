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

export interface RevenueReport {
  period: string;
  monthly: { month: string; invoiced: number; collected: number }[];
  kpis: {
    totalInvoiced: number;
    collected: number;
    collectionRate: number;
    outstanding: number;
    avgPerChild: number;
  };
  aging: { d0_30: number; d31_60: number; d61_90: number; d90_plus: number };
  byChild: { child_id: number; child_name: string; outstanding: number }[];
}

export const financeKeys = {
  all: ['finance'] as const,
  summary: () => [...financeKeys.all, 'summary'] as const,
  overdue: () => [...financeKeys.all, 'overdue'] as const,
  revenue: (period: string) => [...financeKeys.all, 'revenue', period] as const,
};

export function useFinanceSummary() {
  return useQuery({
    queryKey: financeKeys.summary(),
    queryFn: () => api.get<FinanceSummary>('/finance/summary'),
  });
}

export function useRevenue(period = '12M') {
  return useQuery({
    queryKey: financeKeys.revenue(period),
    queryFn: () => api.get<RevenueReport>(`/finance/revenue?period=${period}`),
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
