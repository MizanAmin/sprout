import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Admissions waiting list (the `waiting_list` table, migration 007).
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

const statusEnum = z.enum(['waiting', 'offered', 'enrolled', 'withdrawn']);

const createSchema = z.object({
  childName: z.string().min(1),
  parentName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  desiredStart: z.string().optional(),
  room: z.string().optional(),
  daysRequired: z.string().optional(),
  notes: z.string().optional(),
  position: z.number().int().default(0),
  status: statusEnum.default('waiting'),
});

const updateSchema = createSchema.partial();

const COLS: Record<string, string> = {
  childName: 'child_name',
  parentName: 'parent_name',
  email: 'email',
  phone: 'phone',
  dob: 'dob',
  desiredStart: 'desired_start',
  room: 'room',
  daysRequired: 'days_required',
  notes: 'notes',
  position: 'position',
  status: 'status',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const status = c.req.query('status');
  const params: unknown[] = [nurseryId];
  let sql = 'SELECT * FROM waiting_list WHERE nursery_id=$1';
  if (status) {
    params.push(status);
    sql += ` AND status=$${params.length}`;
  }
  sql += ' ORDER BY position ASC';
  const { rows } = await withTenant(nurseryId, (client) => client.query(sql, params));
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM waiting_list WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Waiting list entry not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO waiting_list
         (nursery_id, child_name, parent_name, email, phone, dob, desired_start, room, days_required, notes, position, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        nurseryId,
        b.childName,
        b.parentName ?? null,
        b.email ?? null,
        b.phone ?? null,
        b.dob ?? null,
        b.desiredStart ?? null,
        b.room ?? null,
        b.daysRequired ?? null,
        b.notes ?? null,
        b.position,
        b.status,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) {
    return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  }
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE waiting_list SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Waiting list entry not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM waiting_list WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Waiting list entry not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

const moveSchema = z.object({ direction: z.enum(['up', 'down']) });

// Reorder by swapping the position with the adjacent entry in queue order.
app.patch('/:id/move', zValidator('json', moveSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { direction } = c.req.valid('json');

  const result = await withTenant(nurseryId, async (client) => {
    const { rows: current } = await client.query(
      'SELECT id, position FROM waiting_list WHERE id=$1 AND nursery_id=$2',
      [id, nurseryId],
    );
    const entry = current[0] as { id: number; position: number } | undefined;
    if (!entry) return { notFound: true as const };

    // Find the adjacent neighbour: the closest entry above (smaller position) for
    // 'up', or below (larger position) for 'down'. Ties broken by id for stability.
    const neighbourSql =
      direction === 'up'
        ? `SELECT id, position FROM waiting_list
             WHERE nursery_id=$1 AND (position < $2 OR (position = $2 AND id < $3))
             ORDER BY position DESC, id DESC LIMIT 1`
        : `SELECT id, position FROM waiting_list
             WHERE nursery_id=$1 AND (position > $2 OR (position = $2 AND id > $3))
             ORDER BY position ASC, id ASC LIMIT 1`;
    const { rows: neighbours } = await client.query(neighbourSql, [
      nurseryId,
      entry.position,
      entry.id,
    ]);
    const neighbour = neighbours[0] as { id: number; position: number } | undefined;
    // Already at the edge of the queue — nothing to swap with.
    if (!neighbour) return { noop: true as const };

    await client.query('UPDATE waiting_list SET position=$1 WHERE id=$2 AND nursery_id=$3', [
      neighbour.position,
      entry.id,
      nurseryId,
    ]);
    await client.query('UPDATE waiting_list SET position=$1 WHERE id=$2 AND nursery_id=$3', [
      entry.position,
      neighbour.id,
      nurseryId,
    ]);

    const { rows } = await client.query(
      'SELECT * FROM waiting_list WHERE id=$1 AND nursery_id=$2',
      [entry.id, nurseryId],
    );
    return { row: rows[0] };
  });

  if ('notFound' in result) {
    return c.json({ error: 'Waiting list entry not found', code: 'NOT_FOUND' }, 404);
  }
  if ('noop' in result) {
    // No neighbour to swap with; return the entry unchanged.
    const { rows } = await withTenant(nurseryId, (client) =>
      client.query('SELECT * FROM waiting_list WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
    );
    return c.json(rows[0]);
  }
  return c.json(result.row);
});

const fromEnquirySchema = z.object({ enquiryId: z.number().int() });

// Create a waiting_list row from an existing enquiry, mapping shared fields.
app.post('/from-enquiry', zValidator('json', fromEnquirySchema), async (c) => {
  const { nurseryId } = c.get('user');
  const { enquiryId } = c.req.valid('json');

  const row = await withTenant(nurseryId, async (client) => {
    const { rows: enq } = await client.query(
      'SELECT * FROM enquiries WHERE id=$1 AND nursery_id=$2',
      [enquiryId, nurseryId],
    );
    const e = enq[0] as
      | {
          child_name: string;
          parent_name: string | null;
          email: string | null;
          phone: string | null;
          dob: string | null;
          room: string | null;
          start_date: string | null;
          notes: string | null;
        }
      | undefined;
    if (!e) return null;

    // Append to the end of the queue (max position + 1).
    const { rows: posRows } = await client.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM waiting_list WHERE nursery_id=$1',
      [nurseryId],
    );
    const nextPosition = Number((posRows[0] as { next: number }).next);

    const { rows } = await client.query(
      `INSERT INTO waiting_list
         (nursery_id, child_name, parent_name, email, phone, dob, desired_start, room, days_required, notes, position, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        nurseryId,
        e.child_name,
        e.parent_name ?? null,
        e.email ?? null,
        e.phone ?? null,
        e.dob ?? null,
        e.start_date ?? null,
        e.room ?? null,
        null,
        e.notes ?? null,
        nextPosition,
        'waiting',
      ],
    );
    return rows[0];
  });

  if (!row) return c.json({ error: 'Enquiry not found', code: 'NOT_FOUND' }, 404);
  return c.json(row, 201);
});

export default app;
