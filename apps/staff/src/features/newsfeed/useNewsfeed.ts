import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// Newsfeed post row as returned by the API (snake_case from nursery_events).
export interface NewsfeedPost {
  id: number;
  nursery_id: number;
  type: string;
  title: string;
  description: string | null;
  date: string;
  created_by: string | null;
}

// Mirrors the route's inline createSchema (camelCase).
export interface NewsfeedPostInput {
  type: string;
  title: string;
  description?: string;
  date?: string;
  createdBy?: string;
}

export const newsfeedKeys = {
  all: ['newsfeed'] as const,
  list: () => [...newsfeedKeys.all, 'list'] as const,
  detail: (id: number) => [...newsfeedKeys.all, id] as const,
};

export function useNewsfeed() {
  return useQuery({
    queryKey: newsfeedKeys.list(),
    queryFn: () => api.get<NewsfeedPost[]>('/newsfeed'),
  });
}

export function useCreateNewsfeedPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewsfeedPostInput) => api.post<NewsfeedPost>('/newsfeed', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: newsfeedKeys.list() }),
  });
}

export function useUpdateNewsfeedPost(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewsfeedPostInput) => api.patch<NewsfeedPost>(`/newsfeed/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: newsfeedKeys.list() });
      qc.invalidateQueries({ queryKey: newsfeedKeys.detail(id) });
    },
  });
}

export function useDeleteNewsfeedPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/newsfeed/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: newsfeedKeys.list() }),
  });
}
