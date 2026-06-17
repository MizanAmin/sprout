import { runInvoiceGenerator } from './invoiceGenerator';
import { runInvoiceReminders } from './invoiceReminders';
import { runTrialWarnings } from './trialWarnings';
import { runBackup } from './backup';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function safeRun(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    const result = await fn();
    console.log(`[job:${name}]`, result);
  } catch (err) {
    console.error(`[job:${name}] failed:`, err);
  }
}

// Register the background jobs on their cadences. Call once at worker startup.
// Deploy as a separate Railway "worker" service so the API server stays stateless.
export function scheduleJobs(): void {
  setInterval(() => void safeRun('invoiceGenerator', runInvoiceGenerator), HOUR);
  setInterval(() => void safeRun('invoiceReminders', runInvoiceReminders), HOUR);
  setInterval(() => void safeRun('trialWarnings', runTrialWarnings), DAY);
  setInterval(() => void safeRun('backup', runBackup), DAY);
}

export { runInvoiceGenerator, runInvoiceReminders, runTrialWarnings, runBackup };
