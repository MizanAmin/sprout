import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { messageCreateSchema, messageUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// messages (migration 008). Staff side of the two-way thread; parents post/read
// via parent.ts. Staff messages are stamped from_role='staff'.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'), auditLog);

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM messages
       WHERE nursery_id=$1 AND ($2::int IS NULL OR child_id=$2)
       ORDER BY created_at DESC`,
      [nurseryId, childId ?? null],
    ),
  );
  return c.json(rows);
});

// Unread count of parent→staff messages (badge on the staff Messages page).
app.get('/unread', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT COUNT(*)::int AS count FROM messages
       WHERE nursery_id=$1 AND from_role='parent' AND is_read=false`,
      [nurseryId],
    ),
  );
  return c.json({ count: rows[0].count });
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM messages WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Message not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', messageCreateSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO messages (nursery_id, child_id, from_role, from_name, body)
       VALUES ($1,$2,'staff',$3,$4)
       RETURNING *`,
      [nurseryId, b.childId ?? null, name, b.body],
    ),
  );
  // TODO: trigger Expo push to the child's guardians (services/push).
  return c.json(rows[0], 201);
});

// Mark all parent→staff messages for a child as read (clears the badge).
app.patch('/read', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE messages SET is_read=true
       WHERE nursery_id=$1 AND from_role='parent' AND is_read=false
         AND ($2::int IS NULL OR child_id=$2)
       RETURNING id`,
      [nurseryId, childId ?? null],
    ),
  );
  return c.json({ ok: true, updated: rows.length });
});

app.patch('/:id', zValidator('json', messageUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json');
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (b.body !== undefined) {
    sets.push(`body=$${i++}`);
    vals.push(b.body);
  }
  if (b.isRead !== undefined) {
    sets.push(`is_read=$${i++}`);
    vals.push(b.isRead);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE messages SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Message not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM messages WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Message not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
