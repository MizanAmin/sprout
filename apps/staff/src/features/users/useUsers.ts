import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserCreateInput, UserUpdateInput } from '@sprout/schemas';
import { api } from '../../api';

// User row as returned by the API (snake_case from the DB).
export interface User {
  id: string;
  nursery_id: number;
  name: string;
  email: string;
  role: 'manager' | 'staff' | 'parent';
  created_at: string;
}

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
};

export function useUsers() {
  return useQuery({ queryKey: userKeys.list(), queryFn: () => api.get<User[]>('/users') });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreateInput) => api.post<User>('/users', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UserUpdateInput) => api.patch<User>(`/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}
