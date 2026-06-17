import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { relativeCreateSchema, relativeUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

const app = new Hono<HonoEnv>();
app.use('*', requireAuth);

const COLS: Record<string, string> = {
  childId: 'child_id',
  name: 'name',
  relation: 'relation',
  phone: 'phone',
  email: 'email',
  address: 'address',
  isPrimaryContact: 'is_primary_contact',
  isEmergencyContact: 'is_emergency_contact',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  // Optional ?childId= filter to fetch a single child's relatives.
  const childId = c.req.query('childId');
  const { rows } = await withTenant(nurseryId, (client) =>
    childId
      ? client.query(
          'SELECT * FROM relatives WHERE nursery_id=$1 AND child_id=$2 ORDER BY name',
          [nurseryId, childId],
        )
      : client.query('SELECT * FROM relatives WHERE nursery_id=$1 ORDER BY name', [nurseryId]),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM relatives WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Relative not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', requireRole('manager', 'staff'), zValidator('json', relativeCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO relatives
         (nursery_id, child_id, name, relation, phone, email, address, is_primary_contact, is_emergency_contact)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        nurseryId,
        b.childId ?? null,
        b.name,
        b.relation ?? null,
        b.phone ?? null,
        b.email ?? null,
        b.address ?? null,
        b.isPrimaryContact ?? false,
        b.isEmergencyContact ?? true,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', requireRole('manager', 'staff'), zValidator('json', relativeUpdateSchema), async (c) => {
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
      `UPDATE relatives SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Relative not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', requireRole('manager', 'staff'), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM relatives WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Relative not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
