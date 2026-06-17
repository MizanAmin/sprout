import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ConsentTemplateCreateInput,
  ConsentFormCreateInput,
} from '@sprout/schemas';
import { api } from '../../api';

export type ConsentFormStatus = 'pending' | 'signed' | 'declined';

// Consent template row as returned by the API (snake_case from the DB).
export interface ConsentTemplate {
  id: number;
  nursery_id: number;
  title: string;
  body: string;
  version: string;
  active: boolean;
  created_at: string;
}

// Consent form row as returned by the API (snake_case from the DB).
export interface ConsentForm {
  id: number;
  nursery_id: number;
  template_id: number | null;
  child_id: number | null;
  child_name: string;
  signed_by: string;
  signed_at: string | null;
  signature_data: string;
  status: ConsentFormStatus;
  created_at: string;
}

export interface ConsentFormFilters {
  status?: string;
}

export const consentKeys = {
  all: ['consents'] as const,
  templates: () => [...consentKeys.all, 'templates'] as const,
  forms: (f: ConsentFormFilters) => [...consentKeys.all, 'forms', f] as const,
};

function formsQueryString(f: ConsentFormFilters): string {
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  const s = p.toString();
  return s ? `?${s}` : '';
}

// --- Templates ---

export function useConsentTemplates() {
  return useQuery({
    queryKey: consentKeys.templates(),
    queryFn: () => api.get<ConsentTemplate[]>('/consents/templates'),
  });
}

export function useCreateConsentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ConsentTemplateCreateInput) =>
      api.post<ConsentTemplate>('/consents/templates', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: consentKeys.templates() }),
  });
}

export function useUpdateConsentTemplate(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ConsentTemplateCreateInput) =>
      api.patch<ConsentTemplate>(`/consents/templates/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: consentKeys.templates() }),
  });
}

export function useDeleteConsentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/consents/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: consentKeys.templates() }),
  });
}

// --- Forms ---

export function useConsentForms(filters: ConsentFormFilters = {}) {
  return useQuery({
    queryKey: consentKeys.forms(filters),
    queryFn: () => api.get<ConsentForm[]>(`/consents${formsQueryString(filters)}`),
  });
}

export function useCreateConsentForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ConsentFormCreateInput) => api.post<ConsentForm>('/consents', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: consentKeys.all }),
  });
}

export function useUpdateConsentFormStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ConsentFormStatus }) =>
      api.patch<ConsentForm>(`/consents/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: consentKeys.all }),
  });
}

export function useDeleteConsentForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/consents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: consentKeys.all }),
  });
}
