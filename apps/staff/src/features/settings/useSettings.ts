import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../api';

// Nursery settings row as returned by the API (snake_case from the DB).
export interface NurserySettings {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  ofsted_no: string;
  logo_url: string;
  fee_rate: number;
  fee_rate_under2: number;
  fee_rate_2yo: number;
  fee_rate_3to4: number;
  funding_rate_under2: number;
  funding_rate_2yo: number;
  funding_rate_3to4: number;
  auto_invoice_enabled: boolean;
  auto_invoice_day: number;
  reminder_enabled: boolean;
  reminder_days_overdue: number;
  reminder_interval_days: number;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  invoice_prefix: string;
  invoice_footer: string;
  payment_terms_days: number;
}

// All fields optional — a PATCH may send any subset.
export const settingsUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  ofstedNo: z.string().optional(),
  logoUrl: z.string().optional(),
  feeRate: z.number().optional(),
  feeRateUnder2: z.number().optional(),
  feeRate2yo: z.number().optional(),
  feeRate3to4: z.number().optional(),
  fundingRateUnder2: z.number().optional(),
  fundingRate2yo: z.number().optional(),
  fundingRate3to4: z.number().optional(),
  autoInvoiceEnabled: z.boolean().optional(),
  autoInvoiceDay: z.number().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderDaysOverdue: z.number().optional(),
  reminderIntervalDays: z.number().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
  invoicePrefix: z.string().optional(),
  invoiceFooter: z.string().optional(),
  paymentTermsDays: z.number().optional(),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

export const settingsKeys = {
  all: ['settings'] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => api.get<NurserySettings>('/settings'),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SettingsUpdateInput) => api.patch<NurserySettings>('/settings', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

// ── GoCardless connection settings ───────────────────────────
// The API never returns the raw token: only whether one is set and a masked hint.
export interface GoCardlessSettings {
  connected: boolean;
  hint: string;
}

export const gocardlessKeys = {
  all: ['gocardless-settings'] as const,
};

export function useGoCardlessSettings() {
  return useQuery({
    queryKey: gocardlessKeys.all,
    queryFn: () => api.get<GoCardlessSettings>('/payments/gocardless-settings'),
  });
}

export function useUpdateGoCardlessSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api.put<GoCardlessSettings>('/payments/gocardless-settings', { token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: gocardlessKeys.all }),
  });
}
