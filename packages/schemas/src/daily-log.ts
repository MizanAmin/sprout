import { z } from 'zod';

// Mirrors the `daily_logs` table (migration 003).
export const dailyLogCreateSchema = z.object({
  childId: z.number().int().positive(),
  date: z.string().optional(),
  time: z.string().optional(),
  type: z.enum(['meal', 'sleep', 'nappy', 'mood', 'activity', 'note']),
  details: z.string().optional(),
  addedBy: z.string().optional(),
});

export const dailyLogUpdateSchema = dailyLogCreateSchema.partial();

export type DailyLogCreateInput = z.infer<typeof dailyLogCreateSchema>;
export type DailyLogUpdateInput = z.infer<typeof dailyLogUpdateSchema>;
