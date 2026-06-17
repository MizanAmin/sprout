import { pool } from '../db';
import { sendInvoiceReminder } from '../services/email';

// Runs hourly. For each nursery with reminders enabled, emails the primary
// contact for every overdue invoice that is past the overdue threshold and
// hasn't been reminded within the configured interval. Logs each attempt.
export async function runInvoiceReminders(): Promise<{ sent: number }> {
  const { rows: nurseries } = await pool.query(`SELECT * FROM nurseries WHERE reminder_enabled = true`);

  let sent = 0;
  for (const n of nurseries) {
    // Include past-due Pending invoices, not just ones already flagged Overdue —
    // nothing auto-flips Pending→Overdue at the due date, so filtering on Overdue
    // alone would never remind manually-paid invoices. Threshold is >= so
    // "N days overdue" fires on day N.
    const { rows: invoices } = await pool.query(
      `SELECT * FROM invoices
       WHERE nursery_id=$1
         AND status IN ('Pending','Overdue')
         AND due_date IS NOT NULL
         AND (CURRENT_DATE - due_date) >= $2
         AND (reminder_sent_at IS NULL OR reminder_sent_at < NOW() - make_interval(days => $3))`,
      [n.id, n.reminder_days_overdue, n.reminder_interval_days],
    );

    for (const inv of invoices) {
      // Primary contact email for the child.
      const { rows: rel } = await pool.query(
        `SELECT email FROM relatives
         WHERE nursery_id=$1 AND child_id=$2 AND is_primary_contact=true AND email <> ''
         ORDER BY id LIMIT 1`,
        [n.id, inv.child_id],
      );
      const to = rel[0]?.email as string | undefined;
      if (!to) continue;

      try {
        await sendInvoiceReminder(to, {
          childName: inv.child_name,
          invoiceRef: inv.invoice_ref,
          amount: Number(inv.amount),
          dueDate: inv.due_date,
          nurseryName: n.name,
        });
        await pool.query(
          `UPDATE invoices SET reminder_sent_at=NOW(), reminder_count=reminder_count+1 WHERE id=$1`,
          [inv.id],
        );
        await pool.query(
          `INSERT INTO reminder_log (nursery_id, invoice_id, to_email, result) VALUES ($1,$2,$3,'sent')`,
          [n.id, inv.id, to],
        );
        sent += 1;
      } catch (err) {
        await pool
          .query(
            `INSERT INTO reminder_log (nursery_id, invoice_id, to_email, result) VALUES ($1,$2,$3,$4)`,
            [n.id, inv.id, to, `error: ${(err as Error).message}`],
          )
          .catch(() => {});
      }
    }
  }

  return { sent };
}
