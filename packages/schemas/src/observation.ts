import { z } from 'zod';

// Mirrors the `observations` table (migration 004). `areas` is the set of EYFS
// areas; `isShared` controls parent visibility.
export const observationCreateSchema = z.object({
  childId: z.number().int().positive(),
  childName: z.string().optional(),
  obsDate: z.string().optional(),
  areas: z.array(z.string()).optional(),
  text: z.string().min(1, 'Observation text is required'),
  photoUrl: z.string().url().optional().or(z.literal('')),
  isShared: z.boolean().optional(),
  practitioner: z.string().optional(),
  score: z.number().int().min(1).max(5).optional(),
});

export const observationUpdateSchema = observationCreateSchema.partial();

export type ObservationCreateInput = z.infer<typeof observationCreateSchema>;
export type ObservationUpdateInput = z.infer<typeof observationUpdateSchema>;
