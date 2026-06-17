import { z } from 'zod';

export const lineItemSchema = z.object({
  description: z.string().min(1),
  hours: z.number().positive().optional(), // session-based lines only
  rate: z.number().positive().optional(), // session-based lines only
  amount: z.number().nonnegative(), // always required; hours * rate for session lines
});

export const invoiceCreateSchema = z.object({
  childId: z.number().int().positive(),
  period: z.string().min(1), // e.g. '2026-06'
  lineItems: z.array(lineItemSchema).min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export type LineItem = z.infer<typeof lineItemSchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
