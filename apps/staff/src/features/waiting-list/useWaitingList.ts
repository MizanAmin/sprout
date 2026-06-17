import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../api';

export type WaitingStatus = 'waiting' | 'offered' | 'enrolled' | 'withdrawn';

// No shared @sprout/schemas for waiting_list — define inline.
// position arrives from a number input; coerce empty → undefined.
const numberOpt = (v: unknown) => (v === '' || v == null ? undefined : Number(v));

export const waitingListCreateSchema = z.object({
  childName: z.string().min(1, 'Child name is required'),
  parentName: z.string().optional(),
  email: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  desiredStart: z.string().optional(),
  room: z.string().optional(),
  daysRequired: z.string().optional(),
  notes: z.string().optional(),
  position: z.preprocess(numberOpt, z.number().int().optional()),
  status: z.enum(['waiting', 'offered', 'enrolled', 'withdrawn']).default('waiting'),
});

export type WaitingListCreateInput = z.infer<typeof waitingListCreateSchema>;

// Waiting list row as returned by the API (snake_case from the DB).
export interface WaitingListEntry {
  id: number;
  nursery_id: number;
  child_name: string;
  parent_name: string;
  email: string;
  phone: string;
  dob: string | null;
  desired_start: string | null;
  room: string;
  days_required: string;
  notes: string;
  position: number;
  status: WaitingStatus;
  created_at: string;
}

export interface WaitingListFilters {
  status?: string;
}

export const waitingListKeys = {
  all: ['waiting-list'] as const,
  list: (f: WaitingListFilters) => [...waitingListKeys.all, 'list', f] as const,
};

function queryString(f: WaitingListFilters): string {
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useWaitingList(filters: WaitingListFilters = {}) {
  return useQuery({
    queryKey: waitingListKeys.list(filters),
    queryFn: () => api.get<WaitingListEntry[]>(`/waiting-list${queryString(filters)}`),
  });
}

export function useCreateWaitingListEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WaitingListCreateInput) =>
      api.post<WaitingListEntry>('/waiting-list', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waitingListKeys.all }),
  });
}

export function useUpdateWaitingListEntry(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WaitingListCreateInput) =>
      api.patch<WaitingListEntry>(`/waiting-list/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waitingListKeys.all }),
  });
}

export function useDeleteWaitingListEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/waiting-list/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: waitingListKeys.all }),
  });
}
