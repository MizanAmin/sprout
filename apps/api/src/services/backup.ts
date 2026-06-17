import { pool } from '../db';
import { uploadFile, listFiles, deleteFiles, storagePaths } from './storage';

// Full database dump to JSON, one file per table, under backups/{YYYY-MM-DD}/.
// Runs as the pool's DB role (bypasses RLS) so it captures every nursery's rows.
// NOTE: this dump includes sensitive columns (e.g. payment_mandates.session_token,
// nurseries.smtp_pass / gocardless_access_token). The bucket is private and
// access is signed-URL only — treat backup files as secret material.

// Hardcoded allowlist — table names are interpolated into SQL, so they must NOT
// come from user input. This is the full schema (migrations 001–012).
const BACKUP_TABLES = [
  'nurseries', 'users', 'user_children',
  'children', 'relatives', 'rooms', 'staff',
  'attendance', 'daily_logs', 'medications', 'incidents', 'accident_book',
  'calendar_events', 'nursery_events',
  'observations', 'assessments', 'reflections', 'planning', 'send_flags',
  'child_sessions', 'rota', 'booking_requests', 'holiday_credit_requests',
  'invoices', 'payments', 'payment_mandates', 'invoice_jobs', 'reminder_log',
  'funding_periods', 'funding_claims',
  'enquiries', 'waiting_list',
  'messages', 'push_subscriptions', 'notification_log',
  'consent_templates', 'consent_forms', 'child_documents',
  'risk_assessments', 'risk_assessment_items', 'policies', 'policy_signoffs',
  'staff_training', 'staff_appraisals', 'qualifications', 'wellbeing_checkins',
  'gdpr_settings', 'sar_requests', 'erasure_requests', 'retention_policies',
  'privacy_notice_ack', 'audit_log',
] as const;

export async function createBackup(dateStr: string): Promise<{ date: string; tables: number; rows: number }> {
  let totalRows = 0;
  for (const table of BACKUP_TABLES) {
    // Identifier is double-quoted and comes only from the constant allowlist above.
    const { rows } = await pool.query(`SELECT * FROM "${table}"`);
    totalRows += rows.length;
    await uploadFile(
      storagePaths.backup(dateStr, table),
      new TextEncoder().encode(JSON.stringify(rows)),
      'application/json',
      true,
    );
  }
  return { date: dateStr, tables: BACKUP_TABLES.length, rows: totalRows };
}

// Delete backup date-folders older than keepDays.
export async function pruneOldBackups(keepDays: number, now: Date): Promise<{ deleted: number }> {
  const folders = await listFiles('backups');
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - keepDays);

  const toDelete: string[] = [];
  for (const folder of folders) {
    const dt = new Date(`${folder.name}T00:00:00Z`);
    if (Number.isNaN(dt.getTime()) || dt >= cutoff) continue;
    const inner = await listFiles(`backups/${folder.name}`);
    for (const file of inner) toDelete.push(`backups/${folder.name}/${file.name}`);
  }
  await deleteFiles(toDelete);
  return { deleted: toDelete.length };
}
