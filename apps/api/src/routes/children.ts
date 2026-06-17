import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { childCreateSchema, childUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

const app = new Hono<HonoEnv>();
app.use('*', requireAuth, auditLog);

// Maps validated (camelCase) body keys → children table columns.
const COLS: Record<string, string> = {
  name: 'name',
  dob: 'dob',
  gender: 'gender',
  room: 'room',
  status: 'status',
  allergy: 'allergy',
  medicalInfo: 'medical_info',
  emergencyContact: 'emergency_contact',
  contactPhone: 'contact_phone',
  notes: 'notes',
  photoUrl: 'photo_url',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM children WHERE nursery_id=$1 ORDER BY name', [nurseryId]),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM children WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Child not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', requireRole('manager', 'staff'), zValidator('json', childCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO children
         (nursery_id, name, dob, gender, room, status, allergy, medical_info, emergency_contact, contact_phone, notes, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        nurseryId,
        b.name,
        b.dob ?? null,
        b.gender ?? null,
        b.room ?? null,
        b.status,
        b.allergy,
        b.medicalInfo ?? null,
        b.emergencyContact ?? null,
        b.contactPhone ?? null,
        b.notes ?? null,
        b.photoUrl ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', requireRole('manager', 'staff'), zValidator('json', childUpdateSchema), async (c) => {
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
      `UPDATE children SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Child not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', requireRole('manager', 'staff'), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM children WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Child not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
