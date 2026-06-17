import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Funded Hours Report (manager only). For a given week, each active child's
// funded hours per weekday (from child_sessions) + weekly total. The LA rate /
// expected-funding figure is applied in the UI from these hours.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface SessionRow {
  child_id: number;
  day: string;
  start_date: string;
  end_date: string | null;
  funded_hours: number | null;
}

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const weekStart = c.req.query('weekStart');
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return c.json({ error: 'weekStart (YYYY-MM-DD) is required', code: 'VALIDATION_ERROR' }, 422);
  }
  // Date for each weekday in this week (weekStart assumed to be the Monday).
  const dayDates = Object.fromEntries(DAYS.map((d, i) => [d, addDaysISO(weekStart, i)])) as Record<
    (typeof DAYS)[number],
    string
  >;
  const weekEnd = dayDates.Fri;

  const { children, sessions } = await withTenant(nurseryId, async (client) => {
    const ch = await client.query(
      `SELECT id, name, room FROM children WHERE nursery_id=$1 AND status='Active' ORDER BY name`,
      [nurseryId],
    );
    const se = await client.query(
      `SELECT child_id, day, start_date, end_date, funded_hours
       FROM child_sessions
       WHERE nursery_id=$1 AND start_date <= $2 AND (end_date IS NULL OR end_date >= $3)`,
      [nurseryId, weekEnd, weekStart],
    );
    return { children: ch.rows, sessions: se.rows as SessionRow[] };
  });

  const byChild = new Map<number, SessionRow[]>();
  for (const s of sessions) {
    const arr = byChild.get(s.child_id) ?? [];
    arr.push(s);
    byChild.set(s.child_id, arr);
  }

  let totalFundedHours = 0;
  const rows = children.map((child: { id: number; name: string; room: string }) => {
    const pats = byChild.get(child.id) ?? [];
    const days: Record<string, number> = {};
    let total = 0;
    for (const d of DAYS) {
      const dateStr = dayDates[d];
      const hours = pats
        .filter((p) => p.day === d && p.start_date <= dateStr && (!p.end_date || p.end_date >= dateStr))
        .reduce((sum, p) => sum + Number(p.funded_hours ?? 0), 0);
      days[d] = hours;
      total += hours;
    }
    totalFundedHours += total;
    return { childId: child.id, name: child.name, room: child.room, days, total };
  });

  return c.json({ weekStart, weekEnd, children: rows, totalFundedHours });
});

export default app;
