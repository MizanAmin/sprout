import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@sprout/db/native';
import { api } from '../../api';

export interface Message {
  id: number;
  child_id: number;
  from_role: 'staff' | 'parent';
  from_name: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export const messageKeys = {
  all: ['messages'] as const,
  thread: (childId: number) => ['messages', childId] as const,
};

// Thread for the active child + a Realtime subscription that refetches on new
// inserts. The channel filter is REQUIRED — Realtime does not enforce RLS, so we
// explicitly scope to this child_id (never rely on RLS for realtime).
export function useMessages(childId: number | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: messageKeys.thread(childId ?? 0),
    queryFn: () => api.get<Message[]>(`/parent/messages?childId=${childId}`),
    enabled: !!childId,
  });

  useEffect(() => {
    if (!childId) return;
    const channel = supabase
      .channel(`messages:child:${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `child_id=eq.${childId}`, // REQUIRED — RLS does not apply to realtime
        },
        () => {
          qc.invalidateQueries({ queryKey: messageKeys.thread(childId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [childId, qc]);

  return query;
}

export function useSendMessage(childId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post('/parent/messages', { childId, body }),
    onSuccess: () => {
      if (childId) qc.invalidateQueries({ queryKey: messageKeys.thread(childId) });
    },
  });
}

export function useMarkRead(childId: number | null) {
  return useMutation({
    mutationFn: () => api.patch(`/parent/messages/read?childId=${childId}`, {}),
  });
}
