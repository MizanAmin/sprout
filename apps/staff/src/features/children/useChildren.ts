import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChildCreateInput, ChildUpdateInput } from '@sprout/schemas';
import { api } from '../../api';

// Child row as returned by the API (snake_case from the DB).
export interface Child {
  id: number;
  nursery_id: number;
  name: string;
  dob: string | null;
  gender: string;
  room: string;
  status: 'Active' | 'Inactive';
  allergy: string;
  medical_info: string;
  emergency_contact: string;
  contact_phone: string;
  notes: string;
  photo_url: string;
  created_at: string;
}

export const childrenKeys = {
  all: ['children'] as const,
  list: () => [...childrenKeys.all, 'list'] as const,
  detail: (id: number) => [...childrenKeys.all, id] as const,
};

export function useChildren() {
  return useQuery({ queryKey: childrenKeys.list(), queryFn: () => api.get<Child[]>('/children') });
}

export function useChild(id: number) {
  return useQuery({
    queryKey: childrenKeys.detail(id),
    queryFn: () => api.get<Child>(`/children/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useCreateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ChildCreateInput) => api.post<Child>('/children', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: childrenKeys.list() }),
  });
}

export function useUpdateChild(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ChildUpdateInput) => api.patch<Child>(`/children/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: childrenKeys.list() });
      qc.invalidateQueries({ queryKey: childrenKeys.detail(id) });
    },
  });
}

export function useDeleteChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/children/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: childrenKeys.list() }),
  });
}

// Age in years from an ISO dob string.
export function ageFromDob(dob: string | null): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age < 1 ? '<1y' : `${age}y`;
}
