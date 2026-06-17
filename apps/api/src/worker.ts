// Background worker entrypoint. Deploy as a SEPARATE Railway service from the
// API (`bun run start:worker`) so the HTTP server stays stateless and a job
// crash can't take down request handling. Bun auto-loads apps/api/.env.
import {
  scheduleJobs,
  runInvoiceGenerator,
  runInvoiceReminders,
  runTrialWarnings,
  runBackup,
} from './jobs';
import { pool } from '@sprout/db/pool';

async function safeRun(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    console.log(`[job:${name}] start`);
    const result = await fn();
    console.log(`[job:${name}] done`, result);
  } catch (err) {
    console.error(`[job:${name}] failed:`, err);
  }
}

// Run each job once on boot so a fresh deploy doesn't sit idle until the first
// interval fires (the longest is 24h). Set RUN_JOBS_ON_START=false to skip.
async function runOnce(): Promise<void> {
  await safeRun('invoiceGenerator', runInvoiceGenerator);
  await safeRun('invoiceReminders', runInvoiceReminders);
  await safeRun('trialWarnings', runTrialWarnings);
  await safeRun('backup', runBackup);
}

// Tiny health server so the platform healthcheck (railway.toml → /health) passes
// for the worker too — it shares the API image. No business routes here.
function startHealthServer(): void {
  Bun.serve({
    port: Number(process.env.PORT) || 3000,
    fetch(req) {
      const { pathname } = new URL(req.url);
      if (pathname === '/health') {
        return new Response(JSON.stringify({ ok: true, worker: true }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    },
  });
}

async function main(): Promise<void> {
  console.log('[worker] starting…');
  startHealthServer();
  if (process.env.RUN_JOBS_ON_START !== 'false') {
    await runOnce();
  }
  scheduleJobs();
  console.log('[worker] jobs scheduled; running.');
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${signal} received, shutting down…`);
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void main();
