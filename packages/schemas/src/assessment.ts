import { z } from 'zod';

// Mirrors the `assessments` table (migration 004) — EYFS area score (1–5).
export const assessmentCreateSchema = z.object({
  childId: z.number().int().positive(),
  area: z.string().min(1, 'Area is required'),
  score: z.number().int().min(1).max(5),
  notes: z.string().optional(),
  practitioner: z.string().optional(),
  assessedAt: z.string().optional(),
});

export const assessmentUpdateSchema = assessmentCreateSchema.partial();

export type AssessmentCreateInput = z.infer<typeof assessmentCreateSchema>;
export type AssessmentUpdateInput = z.infer<typeof assessmentUpdateSchema>;
