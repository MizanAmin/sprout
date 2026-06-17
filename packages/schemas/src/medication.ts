import { z } from 'zod';

// Mirrors the `medications` table (migration 003) — administration records.
export const medicationCreateSchema = z.object({
  childId: z.number().int().positive(),
  medicationName: z.string().min(1, 'Medication name is required'),
  dose: z.string().optional(),
  doseGiven: z.string().optional(),
  frequency: z.string().optional(),
  route: z.string().optional(),
  prescribedBy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  givenBy: z.string().optional(),
  witnessBy: z.string().optional(),
  timeGiven: z.string().optional(),
  refusedReason: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

export const medicationUpdateSchema = medicationCreateSchema.partial();

export type MedicationCreateInput = z.infer<typeof medicationCreateSchema>;
export type MedicationUpdateInput = z.infer<typeof medicationUpdateSchema>;
