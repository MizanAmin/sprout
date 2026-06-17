import { pool } from '../db';
import { sendTrialWarning } from '../services/email';

// Runs daily. Emails a warning to nurseries whose trial ends within 3 days and
// that haven't been warned yet. The flag is only set on a successful send, so a
// failed send is retried on the next run.
export async function runTrialWarnings(now: Date = new Date()): Promise<{ sent: number }> {
  const { rows } = await pool.query(
    `SELECT * FROM nurseries
     WHERE trial_warning_sent = false
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at > NOW()
       AND trial_ends_at <= NOW() + INTERVAL '3 days'`,
  );

  let sent = 0;
  for (const n of rows) {
    if (!n.email) continue;
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(n.trial_ends_at).getTime() - now.getTime()) / 86_400_000),
    );
    try {
      await sendTrialWarning(n.email, {
        nurseryName: n.name,
        trialEndsAt: n.trial_ends_at,
        daysLeft,
      });
      await pool.query(`UPDATE nurseries SET trial_warning_sent = true WHERE id=$1`, [n.id]);
      sent += 1;
    } catch {
      // Leave trial_warning_sent = false so the next run retries.
    }
  }

  return { sent };
}
