import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MedicationCreateInput, MedicationUpdateInput } from '@sprout/schemas';
import { api } from '../../api';

// Medication row as returned by the API (snake_case from the DB).
export interface Medication {
  id: number;
  nursery_id: number;
  child_id: number;
  medication_name: string;
  dose: string;
  dose_given: string;
  frequency: string;
  route: string;
  prescribed_by: string;
  start_date: string | null;
  end_date: string | null;
  given_by: string;
  witness_by: string;
  time_given: string | null;
  refused_reason: string;
  notes: string;
  status: string;
  created_at: string;
}

export const medicationsKeys = {
  all: ['medications'] as const,
  list: () => [...medicationsKeys.all, 'list'] as const,
  detail: (id: number) => [...medicationsKeys.all, id] as const,
};

export function useMedications() {
  return useQuery({
    queryKey: medicationsKeys.list(),
    queryFn: () => api.get<Medication[]>('/medications'),
  });
}

export function useCreateMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MedicationCreateInput) => api.post<Medication>('/medications', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: medicationsKeys.list() }),
  });
}

export function useUpdateMedication(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MedicationUpdateInput) => api.patch<Medication>(`/medications/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: medicationsKeys.list() });
      qc.invalidateQueries({ queryKey: medicationsKeys.detail(id) });
    },
  });
}

export function useDeleteMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/medications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: medicationsKeys.list() }),
  });
}
