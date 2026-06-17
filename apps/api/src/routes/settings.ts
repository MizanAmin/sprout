import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Settings (manager only) — manages the nurseries row for this tenant.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

// Maps validated (camelCase) body keys → nurseries table columns.
// Deliberately excludes billing/plan/stripe/trial/system columns.
const COLS: Record<string, string> = {
  name: 'name',
  address: 'address',
  phone: 'phone',
  email: 'email',
  ofstedNo: 'ofsted_no',
  logoUrl: 'logo_url',
  feeRate: 'fee_rate',
  feeRateUnder2: 'fee_rate_under2',
  feeRate2yo: 'fee_rate_2yo',
  feeRate3to4: 'fee_rate_3to4',
  fundingRateUnder2: 'funding_rate_under2',
  fundingRate2yo: 'funding_rate_2yo',
  fundingRate3to4: 'funding_rate_3to4',
  autoInvoiceEnabled: 'auto_invoice_enabled',
  autoInvoiceDay: 'auto_invoice_day',
  reminderEnabled: 'reminder_enabled',
  reminderDaysOverdue: 'reminder_days_overdue',
  reminderIntervalDays: 'reminder_interval_days',
  smtpHost: 'smtp_host',
  smtpPort: 'smtp_port',
  smtpUser: 'smtp_user',
  smtpPass: 'smtp_pass',
  smtpFrom: 'smtp_from',
  gocardlessAccessToken: 'gocardless_access_token',
};

const updateSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
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
  autoInvoiceDay: z.number().int().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderDaysOverdue: z.number().int().optional(),
  reminderIntervalDays: z.number().int().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
  gocardlessAccessToken: z.string().optional(),
});

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM nurseries WHERE id=$1', [nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Nursery not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.patch('/', zValidator('json', updateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json') as Record<string, unknown>;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) {
    return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  }
  vals.push(nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(`UPDATE nurseries SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, vals),
  );
  if (!rows[0]) return c.json({ error: 'Nursery not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

export default app;
