import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Parent native-app API. Every route is parent-only and scoped to the parent's
// own children. Data queries run inside withTenant(..., { role: 'parent',
// childIds }) so the GUCs drive the RLS *_parent_child policies (see migration
// 013). The `children` table itself has tenant isolation only (no parent_child
// policy), so child-list endpoints additionally filter via user_children /
// child_id = ANY($childIds::int[]).
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('parent'));

// Pagination helper — page (default 1), limit (default 20).
function paginate(c: { req: { query: (k: string) => string | undefined } }) {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') ?? '20', 10) || 20);
  return { page, limit, offset: (page - 1) * limit };
}

// Validate a childId query param is one of the parent's children.
// Returns the numeric id, or null if missing/invalid/not owned.
function ownedChildId(raw: string | undefined, childIds: number[]): number | null {
  if (!raw) return null;
  const id = parseInt(raw, 10);
  if (Number.isNaN(id) || !childIds.includes(id)) return null;
  return id;
}

app.get('/me', async (c) => {
  const user = c.get('user');
  const { nurseryId, childIds, id } = user;
  const result = await withTenant(
    nurseryId,
    async (client) => {
      const children = await client.query(
        `SELECT ch.* FROM user_children uc
           JOIN children ch ON ch.id = uc.child_id
         WHERE uc.user_id = $1 AND uc.nursery_id = $2
         ORDER BY ch.name`,
        [id, nurseryId],
      );
      const nursery = await client.query('SELECT * FROM nurseries WHERE id = $1', [nurseryId]);
      return { children: children.rows, nursery: nursery.rows[0] ?? null };
    },
    { role: 'parent', childIds },
  );
  return c.json({ user, children: result.children, nursery: result.nursery });
});

app.get('/children', async (c) => {
  const { nurseryId, childIds, id } = c.get('user');
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT ch.* FROM user_children uc
           JOIN children ch ON ch.id = uc.child_id
         WHERE uc.user_id = $1 AND uc.nursery_id = $2
         ORDER BY ch.name`,
        [id, nurseryId],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

app.get('/daily-logs', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const childId = ownedChildId(c.req.query('childId'), childIds);
  if (childId === null) return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
  const date = c.req.query('date');
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT * FROM daily_logs
         WHERE child_id = $1 AND is_shared = true AND ($2::date IS NULL OR date = $2)
         ORDER BY date DESC, time DESC NULLS LAST, id DESC`,
        [childId, date ?? null],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

app.get('/report-card', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const childId = ownedChildId(c.req.query('childId'), childIds);
  if (childId === null) return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
  const date = c.req.query('date') ?? null;
  const result = await withTenant(
    nurseryId,
    async (client) => {
      const attendance = await client.query(
        `SELECT * FROM attendance
         WHERE child_id = $1 AND ($2::date IS NULL OR date = $2)
         ORDER BY date DESC LIMIT 1`,
        [childId, date],
      );
      const logs = await client.query(
        `SELECT * FROM daily_logs
         WHERE child_id = $1 AND is_shared = true AND ($2::date IS NULL OR date = $2)
         ORDER BY time DESC NULLS LAST, id DESC`,
        [childId, date],
      );
      return { attendance: attendance.rows[0] ?? null, dailyLogs: logs.rows };
    },
    { role: 'parent', childIds },
  );
  const logs = result.dailyLogs as Array<{ type: string; details: string }>;
  const mood = [...logs].reverse().find((l) => l.type === 'mood')?.details ?? null;
  const mealsCount = logs.filter((l) => l.type === 'meal').length;
  const napsCount = logs.filter((l) => l.type === 'sleep').length;
  const nappiesCount = logs.filter((l) => l.type === 'nappy').length;
  return c.json({
    attendance: result.attendance,
    dailyLogs: result.dailyLogs,
    mood,
    mealsCount,
    napsCount,
    nappiesCount,
  });
});

app.get('/observations', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const childId = ownedChildId(c.req.query('childId'), childIds);
  if (childId === null) return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
  const { offset, limit } = paginate(c);
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT * FROM observations
         WHERE child_id = $1 AND is_shared = true
         ORDER BY obs_date DESC, id DESC
         OFFSET $2 LIMIT $3`,
        [childId, offset, limit],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

app.get('/assessments', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const childId = ownedChildId(c.req.query('childId'), childIds);
  if (childId === null) return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT * FROM assessments
         WHERE child_id = $1
         ORDER BY assessed_at DESC, id DESC`,
        [childId],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

app.get('/invoices', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const status = c.req.query('status');
  const { offset, limit } = paginate(c);
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT * FROM invoices
         WHERE child_id = ANY($1::int[]) AND ($2::text IS NULL OR status = $2)
         ORDER BY created_at DESC, id DESC
         OFFSET $3 LIMIT $4`,
        [childIds, status ?? null, offset, limit],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

app.get('/messages', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const childId = ownedChildId(c.req.query('childId'), childIds);
  if (childId === null) return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
  const { offset, limit } = paginate(c);
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT * FROM messages
         WHERE child_id = $1
         ORDER BY created_at DESC, id DESC
         OFFSET $2 LIMIT $3`,
        [childId, offset, limit],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

app.post(
  '/messages',
  zValidator('json', z.object({ childId: z.number().int(), body: z.string().min(1) })),
  async (c) => {
    const { nurseryId, childIds, name } = c.get('user');
    const b = c.req.valid('json');
    if (!childIds.includes(b.childId)) {
      return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
    }
    const { rows } = await withTenant(
      nurseryId,
      (client) =>
        client.query(
          `INSERT INTO messages (nursery_id, child_id, from_role, from_name, body)
           VALUES ($1, $2, 'parent', $3, $4)
           RETURNING *`,
          [nurseryId, b.childId, name, b.body],
        ),
      { role: 'parent', childIds },
    );
    // TODO: trigger Expo push to the nursery's staff (services/push).
    return c.json(rows[0], 201);
  },
);

app.get('/unread', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT COUNT(*)::int AS count FROM messages
         WHERE from_role = 'staff' AND is_read = false
           AND child_id = ANY($1::int[])`,
        [childIds],
      ),
    { role: 'parent', childIds },
  );
  return c.json({ count: rows[0].count });
});

app.patch('/messages/read', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const childId = ownedChildId(c.req.query('childId'), childIds);
  if (childId === null) return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `UPDATE messages SET is_read = true
         WHERE child_id = $1 AND from_role = 'staff' AND is_read = false
         RETURNING id`,
        [childId],
      ),
    { role: 'parent', childIds },
  );
  return c.json({ ok: true, updated: rows.length });
});

app.get('/consent-forms', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const childId = ownedChildId(c.req.query('childId'), childIds);
  if (childId === null) return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        // Join the template so the parent sees the actual form title + text to sign.
        `SELECT cf.*, ct.title, ct.body, ct.version
         FROM consent_forms cf
         LEFT JOIN consent_templates ct ON ct.id = cf.template_id
         WHERE cf.child_id = $1 AND cf.status = 'pending'
         ORDER BY cf.created_at DESC, cf.id DESC`,
        [childId],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

app.patch(
  '/consent-forms/:id',
  zValidator('json', z.object({ signatureData: z.string().min(1), signedBy: z.string().min(1) })),
  async (c) => {
    const { nurseryId, childIds } = c.get('user');
    const id = c.req.param('id');
    const b = c.req.valid('json');
    const { rows } = await withTenant(
      nurseryId,
      (client) =>
        client.query(
          `UPDATE consent_forms
             SET status = 'signed', signed_at = NOW(), signature_data = $1, signed_by = $2
           WHERE id = $3
           RETURNING *`,
          [b.signatureData, b.signedBy, id],
        ),
      { role: 'parent', childIds },
    );
    if (!rows[0]) return c.json({ error: 'Consent form not found', code: 'NOT_FOUND' }, 404);
    return c.json(rows[0]);
  },
);

app.get('/child-sessions', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const childId = ownedChildId(c.req.query('childId'), childIds);
  if (childId === null) return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT * FROM child_sessions
         WHERE child_id = $1 AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         ORDER BY day, start_time NULLS LAST`,
        [childId],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

// List the parent's submitted booking requests (pending + decided).
app.get('/booking-requests', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  if (childIds.length === 0) return c.json([]);
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT * FROM booking_requests
         WHERE child_id = ANY($1::int[])
         ORDER BY created_at DESC, id DESC`,
        [childIds],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

// List the parent's submitted holiday-credit requests (pending + decided).
app.get('/holiday-requests', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  if (childIds.length === 0) return c.json([]);
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT * FROM holiday_credit_requests
         WHERE child_id = ANY($1::int[])
         ORDER BY created_at DESC, id DESC`,
        [childIds],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

app.post(
  '/booking-requests',
  zValidator(
    'json',
    z.object({
      childId: z.number().int(),
      day: z.string().min(1),
      sessionType: z.string().min(1),
      weekStart: z.string().min(1),
      parentNote: z.string().optional(),
    }),
  ),
  async (c) => {
    const { nurseryId, childIds } = c.get('user');
    const b = c.req.valid('json');
    if (!childIds.includes(b.childId)) {
      return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
    }
    const result = await withTenant(
      nurseryId,
      async (client) => {
        const child = await client.query('SELECT name FROM children WHERE id = $1', [b.childId]);
        if (!child.rows[0]) return null;
        const { rows } = await client.query(
          `INSERT INTO booking_requests
             (nursery_id, child_id, child_name, week_start, day, session_type, parent_note, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
           RETURNING *`,
          [nurseryId, b.childId, child.rows[0].name, b.weekStart, b.day, b.sessionType, b.parentNote ?? ''],
        );
        return rows[0];
      },
      { role: 'parent', childIds },
    );
    if (!result) return c.json({ error: 'Child not found', code: 'NOT_FOUND' }, 404);
    return c.json(result, 201);
  },
);

app.post(
  '/holiday-requests',
  zValidator(
    'json',
    z.object({
      childId: z.number().int(),
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const { nurseryId, childIds } = c.get('user');
    const b = c.req.valid('json');
    if (!childIds.includes(b.childId)) {
      return c.json({ error: 'Access denied to this child', code: 'FORBIDDEN' }, 403);
    }
    const result = await withTenant(
      nurseryId,
      async (client) => {
        const child = await client.query('SELECT name FROM children WHERE id = $1', [b.childId]);
        if (!child.rows[0]) return null;
        const { rows } = await client.query(
          `INSERT INTO holiday_credit_requests
             (nursery_id, child_id, child_name, start_date, end_date, reason, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')
           RETURNING *`,
          [nurseryId, b.childId, child.rows[0].name, b.startDate, b.endDate, b.reason ?? ''],
        );
        return rows[0];
      },
      { role: 'parent', childIds },
    );
    if (!result) return c.json({ error: 'Child not found', code: 'NOT_FOUND' }, 404);
    return c.json(result, 201);
  },
);

app.get('/newsfeed', async (c) => {
  const { nurseryId, childIds } = c.get('user');
  const { rows } = await withTenant(
    nurseryId,
    (client) =>
      client.query(
        `SELECT * FROM nursery_events
         WHERE nursery_id = $1
         ORDER BY date DESC, created_at DESC, id DESC
         LIMIT 20`,
        [nurseryId],
      ),
    { role: 'parent', childIds },
  );
  return c.json(rows);
});

app.post(
  '/push-token',
  zValidator(
    'json',
    z.object({ expoPushToken: z.string().min(1), platform: z.enum(['ios', 'android']) }),
  ),
  async (c) => {
    const { nurseryId, childIds, id } = c.get('user');
    const b = c.req.valid('json');
    const { rows } = await withTenant(
      nurseryId,
      (client) =>
        client.query(
          `INSERT INTO push_subscriptions (nursery_id, user_id, expo_push_token, platform)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (expo_push_token)
           DO UPDATE SET platform = EXCLUDED.platform,
                         user_id = EXCLUDED.user_id,
                         nursery_id = EXCLUDED.nursery_id
           RETURNING *`,
          [nurseryId, id, b.expoPushToken, b.platform],
        ),
      { role: 'parent', childIds },
    );
    return c.json(rows[0], 201);
  },
);

export default app;
