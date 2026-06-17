import { z } from 'zod';

// Mirrors the `children` table (migration 002). Used by the child create/edit
// form on the staff app and `.parse()`d on the API.
export const childCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dob: z.string().optional(), // ISO date (YYYY-MM-DD)
  gender: z.string().optional(),
  room: z.string().optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  allergy: z.string().default('None'),
  medicalInfo: z.string().optional(),
  emergencyContact: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
});

// All fields optional for PATCH-style updates.
export const childUpdateSchema = childCreateSchema.partial();

export type ChildCreateInput = z.infer<typeof childCreateSchema>;
export type ChildUpdateInput = z.infer<typeof childUpdateSchema>;
