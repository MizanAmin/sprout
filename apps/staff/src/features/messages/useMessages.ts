import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MessageCreateInput } from '@sprout/schemas';
import { api } from '../../api';

// Message row as returned by the API (snake_case from the DB).
export interface Message {
  id: number;
  child_id: number | null;
  from_role: string;
  from_name: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export const messageKeys = {
  all: ['messages'] as const,
  list: () => [...messageKeys.all, 'list'] as const,
  unread: () => [...messageKeys.all, 'unread'] as const,
};

export function useMessages() {
  return useQuery({
    queryKey: messageKeys.list(),
    queryFn: () => api.get<Message[]>('/messages'),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: messageKeys.unread(),
    queryFn: () => api.get<{ count: number }>('/messages/unread'),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MessageCreateInput) => api.post<Message>('/messages', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: messageKeys.all }),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (childId: number) =>
      api.patch<{ ok: true }>(`/messages/read?childId=${childId}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: messageKeys.all }),
  });
}
