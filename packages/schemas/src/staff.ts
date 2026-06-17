import { z } from 'zod';

// Mirrors the `staff` table (migration 002) — HR records, distinct from login
// accounts in the `users` table (see [[user]]).
export const staffCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.string().optional(),
  room: z.string().optional(),
  qualification: z.string().optional(),
  phone: z.string().optional(),
  startDate: z.string().optional(), // ISO date (YYYY-MM-DD)
  status: z.enum(['Active', 'Inactive']).optional(),
});

export const staffUpdateSchema = staffCreateSchema.partial();

export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
