import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InvoiceCreateInput, LineItem } from '@sprout/schemas';
import { api } from '../../api';

export type InvoiceStatus = 'Pending' | 'Paid' | 'Overdue' | 'Cancelled';

export interface Invoice {
  id: number;
  nursery_id: number;
  child_id: number | null;
  child_name: string;
  invoice_ref: string;
  period: string;
  amount: number;
  amount_paid: number;
  status: InvoiceStatus;
  due_date: string | null;
  line_items: LineItem[];
  notes: string;
  reminder_count: number;
  created_at: string;
}

export interface InvoiceFilters {
  status?: string;
  childId?: number;
}

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (f: InvoiceFilters) => [...invoiceKeys.all, 'list', f] as const,
};

function queryString(f: InvoiceFilters): string {
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  if (f.childId) p.set('childId', String(f.childId));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => api.get<Invoice[]>(`/invoices${queryString(filters)}`),
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InvoiceCreateInput) => api.post<Invoice>('/invoices', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export interface InvoiceUpdateInput {
  status?: InvoiceStatus;
  dueDate?: string;
  notes?: string;
  lineItems?: LineItem[];
}

export function useUpdateInvoice(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InvoiceUpdateInput) => api.patch<Invoice>(`/invoices/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Invoice>(`/invoices/${id}/mark-paid`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function useSendInvoiceReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Invoice>(`/invoices/${id}/send-reminder`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/invoices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}
