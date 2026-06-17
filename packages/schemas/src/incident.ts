import { z } from 'zod';

// Mirrors the `incidents` table (migration 003). child_id is optional — an
// incident need not relate to a specific child.
export const incidentCreateSchema = z.object({
  childId: z.number().int().positive().optional(),
  childName: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  type: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  actionTaken: z.string().optional(),
  witness: z.string().optional(),
  reportedBy: z.string().optional(),
  parentInformed: z.boolean().optional(),
  parentInformedAt: z.string().optional(),
  signedBy: z.string().optional(),
});

export const incidentUpdateSchema = incidentCreateSchema.partial();

export type IncidentCreateInput = z.infer<typeof incidentCreateSchema>;
export type IncidentUpdateInput = z.infer<typeof incidentUpdateSchema>;
