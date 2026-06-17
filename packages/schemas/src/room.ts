import { z } from 'zod';

// Mirrors the `rooms` table (migration 002).
export const roomCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  capacity: z.number().int().positive().optional(),
  ageGroup: z.string().optional(),
  staffLead: z.string().optional(),
  color: z.string().optional(),
});

export const roomUpdateSchema = roomCreateSchema.partial();

export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;
