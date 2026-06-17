import { createBackup, pruneOldBackups } from '../services/backup';

// Runs daily. Dumps every table to JSON under backups/{date}/ in Supabase
// Storage, then prunes backup folders older than 30 days.
export async function runBackup(
  now: Date = new Date(),
): Promise<{ date: string; tables: number; rows: number; pruned: number }> {
  const date = now.toISOString().slice(0, 10);
  const result = await createBackup(date);
  const { deleted } = await pruneOldBackups(30, now);
  return { ...result, pruned: deleted };
}
