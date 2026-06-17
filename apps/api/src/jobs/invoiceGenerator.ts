import { pool } from '../db';
import { expandPatternsForRange } from '../services/sessionPatterns';
import { ageBandForDob, ratesForBand, type NurseryRates } from '../services/ageBands';

// Runs hourly. Two-layer duplicate guard makes a restart or double-fire safe:
//   1. nursery-level — only nurseries whose auto_invoice_day is today AND that
//      haven't already run this calendar month (auto_invoice_last_run).
//   2. child-level — skip any child that already has an invoice for this period.
// Runs on the pool (system role) so it spans all nurseries.
export async function runInvoiceGenerator(now: Date = new Date()): Promise<{ period: string; created: number }> {
  const dayOfMonth = now.getDate();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodStart = `${period}-01`;
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  // Layer 1: nursery-level gate.
  const { rows: nurseries } = await pool.query(
    `SELECT * FROM nurseries
     WHERE auto_invoice_enabled = true
       AND auto_invoice_day = $1
       AND (auto_invoice_last_run IS NULL OR auto_invoice_last_run < date_trunc('month', CURRENT_DATE))`,
    [dayOfMonth],
  );

  let created = 0;
  for (const nursery of nurseries) {
    const { rows: children } = await pool.query(
      `SELECT id, name, dob FROM children WHERE nursery_id=$1 AND status='Active'`,
      [nursery.id],
    );

    let nurseryCount = 0;
    let nurseryTotal = 0;
    let jobError = '';
    try {
      for (const child of children) {
        // Layer 2: child-level guard.
        const { rows: existing } = await pool.query(
          `SELECT id FROM invoices WHERE nursery_id=$1 AND child_id=$2 AND period=$3 LIMIT 1`,
          [nursery.id, child.id, period],
        );
        if (existing.length > 0) continue;

        const { rows: sessions } = await pool.query(
          `SELECT day, start_date, end_date, fee_hours, funded_hours
           FROM child_sessions WHERE nursery_id=$1 AND child_id=$2`,
          [nursery.id, child.id],
        );
        const { feeHours } = expandPatternsForRange(sessions, periodStart, periodEnd);
        const { feeRate } = ratesForBand(nursery as NurseryRates, ageBandForDob(child.dob));
        const amount = Number((feeHours * feeRate).toFixed(2));
        if (amount <= 0) continue;

        await pool.query(
          `INSERT INTO invoices (nursery_id, child_id, child_name, invoice_ref, period, amount, status, due_date, line_items)
           VALUES ($1,$2,$3,$4,$5,$6,'Pending',$7,$8)`,
          [
            nursery.id,
            child.id,
            child.name,
            `INV-${nursery.id}-${child.id}-${period}`,
            period,
            amount,
            periodEnd,
            JSON.stringify([{ description: `${period} sessions`, hours: feeHours, rate: feeRate, amount }]),
          ],
        );
        nurseryCount += 1;
        nurseryTotal += amount;
        created += 1;
      }
      // Mark the nursery's run only after all children processed successfully.
      await pool.query(`UPDATE nurseries SET auto_invoice_last_run = CURRENT_DATE WHERE id=$1`, [nursery.id]);
    } catch (err) {
      jobError = (err as Error).message;
    }

    await pool
      .query(
        `INSERT INTO invoice_jobs (nursery_id, period, count, total, status, error)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [nursery.id, period, nurseryCount, nurseryTotal, jobError ? 'error' : 'success', jobError],
      )
      .catch(() => {});
  }

  return { period, created };
}
