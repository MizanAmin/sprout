import { forwardRef, useState } from 'react';
import type { ReactNode } from 'react';
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
import { Field, Spinner, EmptyState, Badge } from '../components/ui';

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
  if (!settings) return <EmptyState title="Settings unavailable" description="Could not load nursery settings." />;
  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: NurserySettings }) {
  const update = useUpdateSettings();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
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
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <div className="flex items-center gap-3">
            {saved && <Badge variant="success">Saved</Badge>}
            {update.isError && <Badge variant="danger">Save failed</Badge>}
            <button type="submit" className="btn-primary" disabled={update.isPending || !isDirty}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Two-column layout mirroring the reference Settings page. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ── Left column ───────────────────────────────────── */}
          <div className="space-y-4">
            <Card title="Nursery information">
              {/* Logo: API exposes logo_url; upload widget needs a file endpoint. */}
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg">
                  {settings.logo_url ? (
                    <img src={settings.logo_url} alt="Nursery logo" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-2xl">🌱</span>
                  )}
                </div>
                <div className="flex-1">
                  <Field label="Logo URL" error={errors.logoUrl?.message}>
                    <input {...register('logoUrl')} className="input" placeholder="https://…" />
                  </Field>
                  {/* TODO: needs POST /settings/logo (file upload). API only stores logo_url. */}
                  <p className="mt-1 text-xs text-muted">Paste a logo URL. File upload not yet available.</p>
                </div>
              </div>

              <Field label="Nursery name" error={errors.name?.message}>
                <input {...register('name')} className="input" />
              </Field>
              <Field label="Address" error={errors.address?.message}>
                <textarea {...register('address')} className="input" rows={2} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Phone" error={errors.phone?.message}>
                  <input {...register('phone')} className="input" />
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  <input type="email" {...register('email')} className="input" />
                </Field>
              </div>
              <Field label="Ofsted number" error={errors.ofstedNo?.message}>
                <input {...register('ofstedNo')} className="input" />
              </Field>
            </Card>

            <Card
              title="🧾 Auto invoice settings"
              subtitle="Automatically generate monthly invoices from each child's booked sessions (fee hours × rate, minus funded hours)."
            >
              <Toggle
                label="Auto invoice generation"
                description="Generate invoices each month automatically."
                {...register('autoInvoiceEnabled')}
              />
              <Field label="Run on day of month" error={errors.autoInvoiceDay?.message}>
                <input
                  type="number"
                  min={1}
                  max={28}
                  {...register('autoInvoiceDay', numberOpt)}
                  className="input"
                />
              </Field>

              <SectionLabel>Fee &amp; funding rates by age (£ per hour)</SectionLabel>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Under 2s — fee rate" error={errors.feeRateUnder2?.message}>
                  <input type="number" step="0.01" min="0" {...register('feeRateUnder2', numberOpt)} className="input" />
                </Field>
                <Field label="Under 2s — funding rate" error={errors.fundingRateUnder2?.message}>
                  <input type="number" step="0.01" min="0" {...register('fundingRateUnder2', numberOpt)} className="input" />
                </Field>
                <Field label="2 year olds — fee rate" error={errors.feeRate2yo?.message}>
                  <input type="number" step="0.01" min="0" {...register('feeRate2yo', numberOpt)} className="input" />
                </Field>
                <Field label="2 year olds — funding rate" error={errors.fundingRate2yo?.message}>
                  <input type="number" step="0.01" min="0" {...register('fundingRate2yo', numberOpt)} className="input" />
                </Field>
                <Field label="3 & 4 year olds — fee rate" error={errors.feeRate3to4?.message}>
                  <input type="number" step="0.01" min="0" {...register('feeRate3to4', numberOpt)} className="input" />
                </Field>
                <Field label="3 & 4 year olds — funding rate" error={errors.fundingRate3to4?.message}>
                  <input type="number" step="0.01" min="0" {...register('fundingRate3to4', numberOpt)} className="input" />
                </Field>
                <Field label="Default fee rate" error={errors.feeRate?.message}>
                  <input type="number" step="0.01" min="0" {...register('feeRate', numberOpt)} className="input" />
                </Field>
              </div>
              <p className="text-xs text-muted">
                Fee rate applies to chargeable (non-funded) hours. Funding rate is deducted per funded hour. Age bands
                are based on each child's date of birth.
              </p>
            </Card>

            <Card
              title="🧾 Invoice customisation"
              subtitle="Choose which nursery details show on printed invoices, and add payment details or a footer message."
            >
              {/* TODO: needs GET/PUT /settings/invoice-config — not exposed by apps/api/src/routes/settings.ts */}
              <EmptyState
                title="Invoice customisation unavailable"
                description="The API does not expose an invoice-config endpoint yet."
              />
            </Card>
          </div>

          {/* ── Right column ──────────────────────────────────── */}
          <div className="space-y-4">
            <Card title="Subscription plan">
              {/* TODO: needs plan/billing data — settings API deliberately excludes plan/stripe columns. */}
              <EmptyState
                title="Plan details unavailable"
                description="Billing/plan data is managed elsewhere (see the billing route)."
              />
            </Card>

            <Card title="System preferences">
              {/* TODO: needs a preferences endpoint — these toggles are not backed by the settings API. */}
              <EmptyState
                title="Preferences unavailable"
                description="Email notification and parent-portal toggles have no API endpoint yet."
              />
            </Card>

            <Card
              title="📧 Email reminders"
              subtitle="Automatically email parents when an invoice is past its due date. Requires SMTP details below."
            >
              <Toggle
                label="Overdue invoice reminders"
                description="Send reminder emails for overdue invoices."
                {...register('reminderEnabled')}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Days overdue before first reminder" error={errors.reminderDaysOverdue?.message}>
                  <input type="number" min={1} max={30} {...register('reminderDaysOverdue', numberOpt)} className="input" />
                </Field>
                <Field label="Minimum days between reminders" error={errors.reminderIntervalDays?.message}>
                  <input type="number" min={1} max={30} {...register('reminderIntervalDays', numberOpt)} className="input" />
                </Field>
              </div>

              <SectionLabel>SMTP configuration</SectionLabel>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="SMTP host" error={errors.smtpHost?.message}>
                  <input {...register('smtpHost')} className="input" placeholder="smtp.gmail.com" />
                </Field>
                <Field label="SMTP port" error={errors.smtpPort?.message}>
                  <input type="number" {...register('smtpPort', numberOpt)} className="input" placeholder="587" />
                </Field>
                <Field label="Username / email" error={errors.smtpUser?.message}>
                  <input {...register('smtpUser')} className="input" placeholder="you@gmail.com" />
                </Field>
                <Field label="Password / app password" error={errors.smtpPass?.message}>
                  <input type="password" {...register('smtpPass')} className="input" placeholder="••••••••" />
                </Field>
              </div>
              <Field label="From address (optional)" error={errors.smtpFrom?.message}>
                <input {...register('smtpFrom')} className="input" placeholder="Nursery Name <nursery@example.com>" />
              </Field>
              {/* TODO: needs POST /finance/run-reminders for a "Run reminders now" action. */}
            </Card>

            <Card
              title="💳 Online payments (GoCardless)"
              subtitle="Let parents pay invoices by Direct Debit via your own GoCardless account."
            >
              {/* TODO: needs GET/PUT/DELETE /payments/gocardless-settings — not exposed by the settings API. */}
              <Badge variant="muted">Not connected</Badge>
              <EmptyState
                title="GoCardless settings unavailable"
                description="The API does not expose a GoCardless endpoint yet."
              />
            </Card>
          </div>
        </div>

        {/* Sticky-feel save footer mirroring the reference's per-card save. */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          {saved && <span className="text-sm text-success">All changes saved.</span>}
          <button type="submit" className="btn-primary" disabled={update.isPending || !isDirty}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ── Local layout helpers (card / label / toggle) ───────────── */

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="card space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{children}</p>
  );
}

// Checkbox styled as a labelled row, matching the reference toggle rows.
// forwardRef so react-hook-form's register() ref attaches to the input.
const Toggle = forwardRef<
  HTMLInputElement,
  { label: string; description?: string } & React.InputHTMLAttributes<HTMLInputElement>
>(({ label, description, ...props }, ref) => (
  <label className="flex items-start justify-between gap-4 rounded-lg border border-border bg-bg px-3 py-2.5">
    <span className="space-y-0.5">
      <span className="block text-sm font-semibold text-gray-900">{label}</span>
      {description && <span className="block text-xs text-muted">{description}</span>}
    </span>
    <input type="checkbox" ref={ref} className="mt-0.5 h-4 w-4 accent-primary" {...props} />
  </label>
));
