import { Resend } from 'resend';

// Transactional email via Resend. Lazy singleton so the API boots without it.
let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend = new Resend(key);
  return _resend;
}

const from = () => process.env.EMAIL_FROM ?? 'noreply@sproutnursery.co.uk';

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const { error } = await getResend().emails.send({
    from: from(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.text ? { text: opts.text } : {}),
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
}

const money = (n: number) => `£${n.toFixed(2)}`;

// Overdue-invoice reminder (invoiceReminders job).
export async function sendInvoiceReminder(
  to: string,
  inv: { childName: string; invoiceRef: string; amount: number; dueDate: string | null; nurseryName: string },
): Promise<void> {
  await sendEmail({
    to,
    subject: `Payment reminder — invoice ${inv.invoiceRef}`,
    html: `<p>Hello,</p>
<p>This is a friendly reminder that invoice <strong>${inv.invoiceRef}</strong> for
<strong>${inv.childName}</strong>, amount <strong>${money(inv.amount)}</strong>${
      inv.dueDate ? ` (due ${inv.dueDate})` : ''
}, is currently overdue.</p>
<p>Please arrange payment at your earliest convenience.</p>
<p>Thank you,<br/>${inv.nurseryName}</p>`,
  });
}

// 3-day trial expiry warning (trialWarnings job).
export async function sendTrialWarning(
  to: string,
  n: { nurseryName: string; trialEndsAt: string; daysLeft: number },
): Promise<void> {
  await sendEmail({
    to,
    subject: `Your Sprout trial ends in ${n.daysLeft} day${n.daysLeft === 1 ? '' : 's'}`,
    html: `<p>Hello ${n.nurseryName},</p>
<p>Your Sprout free trial ends on <strong>${new Date(n.trialEndsAt).toLocaleDateString('en-GB')}</strong>
(${n.daysLeft} day${n.daysLeft === 1 ? '' : 's'} left).</p>
<p>Upgrade now to keep uninterrupted access to your nursery management tools.</p>
<p>— The Sprout team</p>`,
  });
}
