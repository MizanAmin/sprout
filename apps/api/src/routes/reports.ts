import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Reports dashboards (manager only) — read-only aggregates.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

// Stat row: Attendance Today % | Active Children | Activities (30d) | Avg EYFS Score
app.get('/overview', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT
         (SELECT COUNT(*) FROM children WHERE nursery_id=$1 AND status='Active')           AS active_children,
         (SELECT COUNT(*) FROM attendance
            WHERE nursery_id=$1 AND date=CURRENT_DATE AND status='present')                AS present_today,
         (SELECT COUNT(*) FROM daily_logs
            WHERE nursery_id=$1 AND date >= CURRENT_DATE - 30)                             AS activities_30d,
         (SELECT AVG(score) FROM assessments WHERE nursery_id=$1)                          AS avg_eyfs_score`,
      [nurseryId],
    ),
  );
  const r = rows[0];
  const activeChildren = Number(r.active_children);
  const presentToday = Number(r.present_today);
  // Expected is approximated as the count of active children.
  return c.json({
    attendanceTodayPct:
      activeChildren > 0 ? Number(((presentToday / activeChildren) * 100).toFixed(1)) : 0,
    activeChildren,
    activities30d: Number(r.activities_30d),
    avgEyfsScore: r.avg_eyfs_score === null ? 0 : Number(Number(r.avg_eyfs_score).toFixed(1)),
  });
});

// Attendance breakdown for a date (default today): present / absent / late / not marked.
app.get('/attendance-breakdown', async (c) => {
  const { nurseryId } = c.get('user');
  const date = c.req.query('date') ?? null;
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT
         (SELECT COUNT(*) FROM children WHERE nursery_id=$1 AND status='Active')        AS active_children,
         COUNT(*) FILTER (WHERE status='present')                                        AS present,
         COUNT(*) FILTER (WHERE status='absent')                                         AS absent,
         COUNT(*) FILTER (WHERE status='late')                                           AS late,
         COUNT(*)                                                                        AS marked
       FROM attendance
       WHERE nursery_id=$1 AND date=COALESCE($2::date, CURRENT_DATE)`,
      [nurseryId, date],
    ),
  );
  const r = rows[0];
  const activeChildren = Number(r.active_children);
  const marked = Number(r.marked);
  return c.json({
    present: Number(r.present),
    absent: Number(r.absent),
    late: Number(r.late),
    notMarked: Math.max(activeChildren - marked, 0),
  });
});

// Active children grouped by room.
app.get('/children-by-room', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT room, COUNT(*)::int AS count
       FROM children
       WHERE nursery_id=$1 AND status='Active'
       GROUP BY room
       ORDER BY room`,
      [nurseryId],
    ),
  );
  return c.json(rows.map((r) => ({ room: r.room, count: Number(r.count) })));
});

// EYFS assessment averages grouped by area.
app.get('/eyfs-by-area', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT area, AVG(score) AS avg_score, COUNT(*)::int AS count
       FROM assessments
       WHERE nursery_id=$1
       GROUP BY area
       ORDER BY area`,
      [nurseryId],
    ),
  );
  return c.json(
    rows.map((r) => ({
      area: r.area,
      avgScore: r.avg_score === null ? 0 : Number(Number(r.avg_score).toFixed(1)),
      count: Number(r.count),
    })),
  );
});

export default app;
