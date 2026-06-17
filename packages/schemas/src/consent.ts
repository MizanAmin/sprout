import { z } from 'zod';

// Mirrors consent_templates + consent_forms (migration 009).

export const consentTemplateCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  version: z.string().optional(),
  active: z.boolean().optional(),
  requiresSignature: z.boolean().optional(),
  category: z.string().optional(),
});
export const consentTemplateUpdateSchema = consentTemplateCreateSchema.partial();

export const consentFormCreateSchema = z.object({
  templateId: z.number().int().positive().optional(),
  childId: z.number().int().positive().optional(),
  childName: z.string().optional(),
  signedBy: z.string().optional(),
  signatureData: z.string().optional(),
  status: z.enum(['pending', 'signed', 'declined']).optional(),
  dueDate: z.string().optional(),
});
export const consentFormUpdateSchema = consentFormCreateSchema.partial();

export type ConsentTemplateCreateInput = z.infer<typeof consentTemplateCreateSchema>;
export type ConsentTemplateUpdateInput = z.infer<typeof consentTemplateUpdateSchema>;
export type ConsentFormCreateInput = z.infer<typeof consentFormCreateSchema>;
export type ConsentFormUpdateInput = z.infer<typeof consentFormUpdateSchema>;
