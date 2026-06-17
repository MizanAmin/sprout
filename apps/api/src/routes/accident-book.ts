import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { accidentCreateSchema, accidentUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// accident_book (migration 003). child_id nullable; child_name denormalised.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'), auditLog);

const COLS: Record<string, string> = {
  childId: 'child_id',
  childName: 'child_name',
  date: 'date',
  time: 'time',
  location: 'location',
  description: 'description',
  injuryType: 'injury_type',
  bodyPart: 'body_part',
  firstAidGiven: 'first_aid_given',
  firstAider: 'first_aider',
  witness: 'witness',
  parentNotifiedAt: 'parent_notified_at',
  followUp: 'follow_up',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM accident_book
       WHERE nursery_id=$1 AND ($2::int IS NULL OR child_id=$2)
       ORDER BY date DESC, id DESC`,
      [nurseryId, childId ?? null],
    ),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM accident_book WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Accident record not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', accidentCreateSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO accident_book
         (nursery_id, child_id, child_name, date, time, location, description, injury_type, body_part,
          first_aid_given, first_aider, witness, parent_notified_at, follow_up)
       VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        nurseryId,
        b.childId ?? null,
        b.childName ?? '',
        b.date ?? null,
        b.time ?? null,
        b.location ?? '',
        b.description ?? '',
        b.injuryType ?? '',
        b.bodyPart ?? '',
        b.firstAidGiven ?? '',
        b.firstAider ?? name,
        b.witness ?? '',
        b.parentNotifiedAt ?? null,
        b.followUp ?? '',
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', accidentUpdateSchema), async (c) => {
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
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE accident_book SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Accident record not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM accident_book WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Accident record not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
