import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../api';

// ---- Settings ----

export interface GdprSettings {
  id: number;
  nursery_id: number;
  data_controller: string;
  dpo_name: string;
  dpo_email: string;
  retention_children: number;
  retention_staff: number;
  retention_cctv: number;
  lawful_basis: string;
  last_audit_date: string | null;
  next_audit_date: string | null;
  ico_registered: boolean;
  ico_number: string;
  privacy_notice: string;
}

export const gdprSettingsSchema = z.object({
  dataController: z.string().optional(),
  dpoName: z.string().optional(),
  dpoEmail: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  retentionChildren: z.number().optional(),
  retentionStaff: z.number().optional(),
  retentionCctv: z.number().optional(),
  lawfulBasis: z.string().optional(),
  lastAuditDate: z.string().optional(),
  nextAuditDate: z.string().optional(),
  icoRegistered: z.boolean().optional(),
  icoNumber: z.string().optional(),
  privacyNotice: z.string().optional(),
});
export type GdprSettingsInput = z.infer<typeof gdprSettingsSchema>;

export function useGdprSettings() {
  return useQuery({
    queryKey: ['gdpr', 'settings'],
    queryFn: () => api.get<GdprSettings | null>('/gdpr/settings'),
  });
}

export function useUpdateGdprSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GdprSettingsInput) => api.patch<GdprSettings>('/gdpr/settings', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'settings'] }),
  });
}

// ---- SAR (subject access requests) ----

export type SarStatus = 'received' | 'in_progress' | 'completed' | 'refused';

export interface SarRequest {
  id: number;
  requester_name: string;
  requester_email: string;
  subject: string;
  received_at: string;
  due_date: string | null;
  status: SarStatus;
  notes: string;
  completed_at: string | null;
}

export const sarCreateSchema = z.object({
  requesterName: z.string().min(1, 'Requester name is required'),
  requesterEmail: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  subject: z.string().optional(),
  receivedAt: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['received', 'in_progress', 'completed', 'refused']).default('received'),
  notes: z.string().optional(),
  completedAt: z.string().optional(),
});
export type SarCreateInput = z.infer<typeof sarCreateSchema>;

export function useSarRequests() {
  return useQuery({ queryKey: ['gdpr', 'sar'], queryFn: () => api.get<SarRequest[]>('/gdpr/sar') });
}

export function useCreateSar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SarCreateInput) => api.post<SarRequest>('/gdpr/sar', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'sar'] }),
  });
}

export function useUpdateSar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SarCreateInput> }) =>
      api.patch<SarRequest>(`/gdpr/sar/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'sar'] }),
  });
}

export function useDeleteSar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/gdpr/sar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'sar'] }),
  });
}

// ---- Erasure requests ----

export type ErasureStatus = 'pending' | 'completed' | 'refused';

export interface ErasureRequest {
  id: number;
  data_subject: string;
  email: string;
  reason: string;
  requested_at: string;
  due_date: string | null;
  status: ErasureStatus;
  completed_at: string | null;
  notes: string;
}

export const erasureCreateSchema = z.object({
  dataSubject: z.string().min(1, 'Data subject is required'),
  email: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  reason: z.string().optional(),
  requestedAt: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'completed', 'refused']).default('pending'),
  completedAt: z.string().optional(),
  notes: z.string().optional(),
});
export type ErasureCreateInput = z.infer<typeof erasureCreateSchema>;

export function useErasureRequests() {
  return useQuery({
    queryKey: ['gdpr', 'erasure'],
    queryFn: () => api.get<ErasureRequest[]>('/gdpr/erasure'),
  });
}

export function useCreateErasure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ErasureCreateInput) => api.post<ErasureRequest>('/gdpr/erasure', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'erasure'] }),
  });
}

export function useUpdateErasure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ErasureCreateInput> }) =>
      api.patch<ErasureRequest>(`/gdpr/erasure/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'erasure'] }),
  });
}

export function useDeleteErasure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/gdpr/erasure/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'erasure'] }),
  });
}

// ---- Retention policies ----

export interface RetentionPolicy {
  id: number;
  data_category: string;
  retention_period_years: number;
  legal_basis: string;
  notes: string;
}

export const retentionCreateSchema = z.object({
  dataCategory: z.string().min(1, 'Data category is required'),
  retentionPeriodYears: z.number().int().min(0),
  legalBasis: z.string().optional(),
  notes: z.string().optional(),
});
export type RetentionCreateInput = z.infer<typeof retentionCreateSchema>;

export function useRetentionPolicies() {
  return useQuery({
    queryKey: ['gdpr', 'retention'],
    queryFn: () => api.get<RetentionPolicy[]>('/gdpr/retention'),
  });
}

export function useCreateRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RetentionCreateInput) => api.post<RetentionPolicy>('/gdpr/retention', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'retention'] }),
  });
}

export function useUpdateRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RetentionCreateInput> }) =>
      api.patch<RetentionPolicy>(`/gdpr/retention/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'retention'] }),
  });
}

export function useDeleteRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/gdpr/retention/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr', 'retention'] }),
  });
}

// ---- Audit log ----

export interface AuditLogEntry {
  id: number;
  nursery_id: number;
  user_id: string | null;
  user_name: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export function useAuditLog() {
  return useQuery({
    queryKey: ['gdpr', 'audit'],
    queryFn: () => api.get<AuditLogEntry[]>('/gdpr/audit'),
  });
}
