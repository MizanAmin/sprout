import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useSettings,
  useUpdateSettings,
  settingsUpdateSchema,
  type NurserySettings,
  type SettingsUpdateInput,
} from '../features/settings/useSettings';
import { Field, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

// Map an API nursery row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(s: NurserySettings): SettingsUpdateInput {
  return {
    name: s.name,
    address: s.address,
    phone: s.phone,
    email: s.email,
    ofstedNo: s.ofsted_no,
    logoUrl: s.logo_url,
    feeRate: s.fee_rate,
    feeRateUnder2: s.fee_rate_under2,
    feeRate2yo: s.fee_rate_2yo,
    feeRate3to4: s.fee_rate_3to4,
    fundingRateUnder2: s.funding_rate_under2,
    fundingRate2yo: s.funding_rate_2yo,
    fundingRate3to4: s.funding_rate_3to4,
    autoInvoiceEnabled: s.auto_invoice_enabled,
    autoInvoiceDay: s.auto_invoice_day,
    reminderEnabled: s.reminder_enabled,
    reminderDaysOverdue: s.reminder_days_overdue,
    reminderIntervalDays: s.reminder_interval_days,
    smtpHost: s.smtp_host,
    smtpPort: s.smtp_port,
    smtpUser: s.smtp_user,
    smtpPass: s.smtp_pass,
    smtpFrom: s.smtp_from,
  };
}

function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  if (isLoading) return <Spinner />;
  if (!settings) return <EmptyState title="Settings unavailable" />;
  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: NurserySettings }) {
  const update = useUpdateSettings();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsUpdateInput>({
    resolver: zodResolver(settingsUpdateSchema),
    defaultValues: toFormValues(settings),
  });

  const onSubmit = (data: SettingsUpdateInput) =>
    update.mutate(data, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        {saved && <p className="text-sm text-success">Saved.</p>}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-8">
        <Section title="Profile">
          <Field label="Name" error={errors.name?.message}>
            <input {...register('name')} className="input" />
          </Field>
          <Field label="Address" error={errors.address?.message}>
            <textarea {...register('address')} className="input" rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} className="input" />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register('email')} className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ofsted number" error={errors.ofstedNo?.message}>
              <input {...register('ofstedNo')} className="input" />
            </Field>
            <Field label="Logo URL" error={errors.logoUrl?.message}>
              <input {...register('logoUrl')} className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Fee rates">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Default fee rate (£/hr)" error={errors.feeRate?.message}>
              <input type="number" step="0.01" {...register('feeRate', numberOpt)} className="input" />
            </Field>
            <Field label="Under 2s fee rate (£/hr)" error={errors.feeRateUnder2?.message}>
              <input type="number" step="0.01" {...register('feeRateUnder2', numberOpt)} className="input" />
            </Field>
            <Field label="2-year-olds fee rate (£/hr)" error={errors.feeRate2yo?.message}>
              <input type="number" step="0.01" {...register('feeRate2yo', numberOpt)} className="input" />
            </Field>
            <Field label="3–4 year olds fee rate (£/hr)" error={errors.feeRate3to4?.message}>
              <input type="number" step="0.01" {...register('feeRate3to4', numberOpt)} className="input" />
            </Field>
            <Field label="Under 2s funding rate (£/hr)" error={errors.fundingRateUnder2?.message}>
              <input type="number" step="0.01" {...register('fundingRateUnder2', numberOpt)} className="input" />
            </Field>
            <Field label="2-year-olds funding rate (£/hr)" error={errors.fundingRate2yo?.message}>
              <input type="number" step="0.01" {...register('fundingRate2yo', numberOpt)} className="input" />
            </Field>
            <Field label="3–4 year olds funding rate (£/hr)" error={errors.fundingRate3to4?.message}>
              <input type="number" step="0.01" {...register('fundingRate3to4', numberOpt)} className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Auto-invoice">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" {...register('autoInvoiceEnabled')} />
            Enable automatic monthly invoicing
          </label>
          <Field label="Day of month" error={errors.autoInvoiceDay?.message}>
            <input type="number" min="1" max="28" {...register('autoInvoiceDay', numberOpt)} className="input" />
          </Field>
        </Section>

        <Section title="Reminders">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" {...register('reminderEnabled')} />
            Send overdue invoice reminders
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Days overdue before first reminder" error={errors.reminderDaysOverdue?.message}>
              <input type="number" {...register('reminderDaysOverdue', numberOpt)} className="input" />
            </Field>
            <Field label="Reminder interval (days)" error={errors.reminderIntervalDays?.message}>
              <input type="number" {...register('reminderIntervalDays', numberOpt)} className="input" />
            </Field>
          </div>
        </Section>

        <Section title="SMTP">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Host" error={errors.smtpHost?.message}>
              <input {...register('smtpHost')} className="input" />
            </Field>
            <Field label="Port" error={errors.smtpPort?.message}>
              <input type="number" {...register('smtpPort', numberOpt)} className="input" />
            </Field>
            <Field label="Username" error={errors.smtpUser?.message}>
              <input {...register('smtpUser')} className="input" />
            </Field>
            <Field label="Password" error={errors.smtpPass?.message}>
              <input type="password" {...register('smtpPass')} className="input" />
            </Field>
          </div>
          <Field label="From address" error={errors.smtpFrom?.message}>
            <input {...register('smtpFrom')} className="input" />
          </Field>
        </Section>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-success">Saved.</span>}
          <button type="submit" className="btn-primary" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}
