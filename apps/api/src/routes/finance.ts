import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Finance dashboards (manager only) — read-only aggregates over invoices.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

// KPI cards: Collected | Pending | Overdue | Collection Rate %
app.get('/summary', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT
         COALESCE(SUM(amount_paid),0)::numeric                                   AS collected,
         COALESCE(SUM(amount) FILTER (WHERE status='Pending'),0)::numeric        AS pending,
         COALESCE(SUM(amount - amount_paid) FILTER (WHERE status='Overdue'),0)::numeric AS overdue,
         COALESCE(SUM(amount) FILTER (WHERE status<>'Cancelled'),0)::numeric     AS total_invoiced
       FROM invoices WHERE nursery_id=$1`,
      [nurseryId],
    ),
  );
  const r = rows[0];
  const totalInvoiced = Number(r.total_invoiced);
  const collected = Number(r.collected);
  return c.json({
    collected,
    pending: Number(r.pending),
    overdue: Number(r.overdue),
    collectionRate: totalInvoiced > 0 ? Number(((collected / totalInvoiced) * 100).toFixed(1)) : 0,
  });
});

// Overdue invoices priority list — child, amount outstanding, one-click reminder.
app.get('/overdue', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT id, child_id, child_name, invoice_ref, amount, amount_paid,
              (amount - amount_paid) AS outstanding, due_date, reminder_count, reminder_sent_at
       FROM invoices
       WHERE nursery_id=$1 AND status='Overdue'
       ORDER BY due_date ASC NULLS LAST`,
      [nurseryId],
    ),
  );
  return c.json(rows);
});

// Revenue report: monthly invoiced vs collected + debt aging.
// ?period=3M|6M|12M|24M (default 12M).
app.get('/revenue', async (c) => {
  const { nurseryId } = c.get('user');
  const period = c.req.query('period') ?? '12M';
  const months = { '3M': 3, '6M': 6, '12M': 12, '24M': 24 }[period] ?? 12;

  const result = await withTenant(nurseryId, async (client) => {
    const monthly = await client.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
              COALESCE(SUM(amount),0)::numeric      AS invoiced,
              COALESCE(SUM(amount_paid),0)::numeric AS collected
       FROM invoices
       WHERE nursery_id=$1 AND created_at >= date_trunc('month', CURRENT_DATE) - ($2::int - 1) * INTERVAL '1 month'
       GROUP BY 1 ORDER BY 1`,
      [nurseryId, months],
    );
    const totals = await client.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status<>'Cancelled'),0)::numeric AS total_invoiced,
         COALESCE(SUM(amount_paid),0)::numeric                               AS collected,
         COALESCE(SUM(amount - amount_paid) FILTER (WHERE status IN ('Pending','Overdue')),0)::numeric AS outstanding,
         COUNT(DISTINCT child_id)                                            AS children
       FROM invoices WHERE nursery_id=$1`,
      [nurseryId],
    );
    const aging = await client.query(
      `SELECT
         COALESCE(SUM(amount - amount_paid) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 0 AND 30),0)::numeric  AS d0_30,
         COALESCE(SUM(amount - amount_paid) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 31 AND 60),0)::numeric AS d31_60,
         COALESCE(SUM(amount - amount_paid) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 61 AND 90),0)::numeric AS d61_90,
         COALESCE(SUM(amount - amount_paid) FILTER (WHERE CURRENT_DATE - due_date > 90),0)::numeric              AS d90_plus
       FROM invoices
       WHERE nursery_id=$1 AND status IN ('Pending','Overdue') AND due_date IS NOT NULL`,
      [nurseryId],
    );
    const byChild = await client.query(
      `SELECT child_id, child_name, COALESCE(SUM(amount - amount_paid),0)::numeric AS outstanding
       FROM invoices
       WHERE nursery_id=$1 AND status IN ('Pending','Overdue')
       GROUP BY child_id, child_name
       HAVING SUM(amount - amount_paid) > 0
       ORDER BY outstanding DESC`,
      [nurseryId],
    );
    return { monthly: monthly.rows, totals: totals.rows[0], aging: aging.rows[0], byChild: byChild.rows };
  });

  const t = result.totals;
  const totalInvoiced = Number(t.total_invoiced);
  const collected = Number(t.collected);
  const children = Number(t.children);
  return c.json({
    period,
    monthly: result.monthly,
    kpis: {
      totalInvoiced,
      collected,
      collectionRate: totalInvoiced > 0 ? Number(((collected / totalInvoiced) * 100).toFixed(1)) : 0,
      outstanding: Number(t.outstanding),
      avgPerChild: children > 0 ? Number((totalInvoiced / children).toFixed(2)) : 0,
    },
    aging: result.aging,
    byChild: result.byChild,
  });
});

export default app;
