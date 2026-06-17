import { z } from 'zod';

// Mirrors the `relatives` table (migration 002). child_id is optional — a
// relative can exist before being linked to a child.
export const relativeCreateSchema = z.object({
  childId: z.number().int().positive().optional(),
  name: z.string().min(1, 'Name is required'),
  relation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  isPrimaryContact: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
});

export const relativeUpdateSchema = relativeCreateSchema.partial();

export type RelativeCreateInput = z.infer<typeof relativeCreateSchema>;
export type RelativeUpdateInput = z.infer<typeof relativeUpdateSchema>;
