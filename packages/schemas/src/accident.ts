import { z } from 'zod';

// Mirrors the `accident_book` table (migration 003). child_id is optional.
export const accidentCreateSchema = z.object({
  childId: z.number().int().positive().optional(),
  childName: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  injuryType: z.string().optional(),
  bodyPart: z.string().optional(),
  firstAidGiven: z.string().optional(),
  firstAider: z.string().optional(),
  witness: z.string().optional(),
  parentNotifiedAt: z.string().optional(),
  followUp: z.string().optional(),
});

export const accidentUpdateSchema = accidentCreateSchema.partial();

export type AccidentCreateInput = z.infer<typeof accidentCreateSchema>;
export type AccidentUpdateInput = z.infer<typeof accidentUpdateSchema>;
