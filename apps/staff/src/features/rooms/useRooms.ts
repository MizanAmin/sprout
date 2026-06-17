import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RoomCreateInput, RoomUpdateInput } from '@sprout/schemas';
import { api } from '../../api';

// Room row as returned by the API (snake_case from the DB).
export interface Room {
  id: number;
  nursery_id: number;
  name: string;
  capacity: number;
  age_group: string;
  staff_lead: string;
  color: string;
}

export const roomsKeys = {
  all: ['rooms'] as const,
  list: () => [...roomsKeys.all, 'list'] as const,
  detail: (id: number) => [...roomsKeys.all, id] as const,
};

export function useRooms() {
  return useQuery({ queryKey: roomsKeys.list(), queryFn: () => api.get<Room[]>('/rooms') });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RoomCreateInput) => api.post<Room>('/rooms', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomsKeys.list() }),
  });
}

export function useUpdateRoom(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RoomUpdateInput) => api.patch<Room>(`/rooms/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomsKeys.list() });
      qc.invalidateQueries({ queryKey: roomsKeys.detail(id) });
    },
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/rooms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomsKeys.list() }),
  });
}
