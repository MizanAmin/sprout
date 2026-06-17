import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { roomCreateSchema, roomUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

const app = new Hono<HonoEnv>();
app.use('*', requireAuth);

const COLS: Record<string, string> = {
  name: 'name',
  capacity: 'capacity',
  ageGroup: 'age_group',
  staffLead: 'staff_lead',
  color: 'color',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM rooms WHERE nursery_id=$1 ORDER BY name', [nurseryId]),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM rooms WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Room not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', requireRole('manager'), zValidator('json', roomCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO rooms (nursery_id, name, capacity, age_group, staff_lead, color)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        nurseryId,
        b.name,
        b.capacity ?? 10,
        b.ageGroup ?? null,
        b.staffLead ?? null,
        b.color ?? '#4f8ef7',
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', requireRole('manager'), zValidator('json', roomUpdateSchema), async (c) => {
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
      `UPDATE rooms SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Room not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', requireRole('manager'), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM rooms WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Room not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
