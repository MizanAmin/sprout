import { z } from 'zod';

// Mirrors the `messages` table (migration 008). child_id is optional —
// null means a nursery-wide broadcast.
export const messageCreateSchema = z.object({
  childId: z.number().int().positive().optional(),
  body: z.string().min(1, 'Message body is required'),
});

export const messageUpdateSchema = z.object({
  body: z.string().min(1).optional(),
  isRead: z.boolean().optional(),
});

export type MessageCreateInput = z.infer<typeof messageCreateSchema>;
export type MessageUpdateInput = z.infer<typeof messageUpdateSchema>;
