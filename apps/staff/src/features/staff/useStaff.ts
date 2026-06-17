import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StaffCreateInput, StaffUpdateInput } from '@sprout/schemas';
import { api } from '../../api';

// Staff row as returned by the API (snake_case from the DB). This is the HR
// `staff` table, distinct from login accounts in the `users` table.
export interface Staff {
  id: number;
  nursery_id: number;
  name: string;
  role: string;
  room: string;
  qualification: string;
  phone: string;
  start_date: string | null;
  status: 'Active' | 'Inactive';
}

export const staffKeys = {
  all: ['staff'] as const,
  list: () => [...staffKeys.all, 'list'] as const,
  detail: (id: number) => [...staffKeys.all, id] as const,
};

export function useStaff() {
  return useQuery({ queryKey: staffKeys.list(), queryFn: () => api.get<Staff[]>('/staff') });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StaffCreateInput) => api.post<Staff>('/staff', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.list() }),
  });
}

export function useUpdateStaff(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StaffUpdateInput) => api.patch<Staff>(`/staff/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.list() });
      qc.invalidateQueries({ queryKey: staffKeys.detail(id) });
    },
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/staff/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.list() }),
  });
}
