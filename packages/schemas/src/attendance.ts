import { z } from 'zod';

// Mirrors the `attendance` table (migration 003).
export const attendanceCreateSchema = z.object({
  childId: z.number().int().positive(),
  date: z.string().optional(),
  status: z.enum(['present', 'absent', 'late']).optional(),
  signIn: z.string().optional(),
  signOut: z.string().optional(),
  absentReason: z.string().optional(),
  signedInBy: z.string().optional(),
  collectedBy: z.string().optional(),
  attNotes: z.string().optional(),
});

export const attendanceUpdateSchema = attendanceCreateSchema.partial();

export type AttendanceCreateInput = z.infer<typeof attendanceCreateSchema>;
export type AttendanceUpdateInput = z.infer<typeof attendanceUpdateSchema>;
