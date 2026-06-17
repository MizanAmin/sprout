import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../api';

export type EnquiryPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type EnquiryStatus = 'New' | 'Contacted' | 'Toured' | 'Offered' | 'Enrolled' | 'Declined';

// No shared @sprout/schemas for enquiries — define inline.
export const enquiryCreateSchema = z.object({
  childName: z.string().min(1, 'Child name is required'),
  parentName: z.string().optional(),
  email: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  room: z.string().optional(),
  startDate: z.string().optional(),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).default('Normal'),
  status: z.enum(['New', 'Contacted', 'Toured', 'Offered', 'Enrolled', 'Declined']).default('New'),
  notes: z.string().optional(),
  source: z.string().optional(),
});

export type EnquiryCreateInput = z.infer<typeof enquiryCreateSchema>;

// Enquiry row as returned by the API (snake_case from the DB).
export interface Enquiry {
  id: number;
  nursery_id: number;
  child_name: string;
  parent_name: string;
  email: string;
  phone: string;
  dob: string | null;
  room: string;
  start_date: string | null;
  priority: EnquiryPriority;
  status: EnquiryStatus;
  notes: string;
  source: string;
  created_at: string;
}

export interface EnquiryFilters {
  status?: string;
}

export const enquiryKeys = {
  all: ['enquiries'] as const,
  list: (f: EnquiryFilters) => [...enquiryKeys.all, 'list', f] as const,
};

function queryString(f: EnquiryFilters): string {
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useEnquiries(filters: EnquiryFilters = {}) {
  return useQuery({
    queryKey: enquiryKeys.list(filters),
    queryFn: () => api.get<Enquiry[]>(`/enquiries${queryString(filters)}`),
  });
}

export function useCreateEnquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EnquiryCreateInput) => api.post<Enquiry>('/enquiries', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: enquiryKeys.all }),
  });
}

export function useUpdateEnquiry(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EnquiryCreateInput) => api.patch<Enquiry>(`/enquiries/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: enquiryKeys.all }),
  });
}

export function useDeleteEnquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/enquiries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: enquiryKeys.all }),
  });
}
