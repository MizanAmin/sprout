import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// reflections (migration 004).
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const createSchema = z.object({
  childId: z.number().int(),
  date: z.string().optional(),
  whatWentWell: z.string().optional(),
  areasForDevelopment: z.string().optional(),
  nextSteps: z.string().optional(),
  practitioner: z.string().optional(),
});

const updateSchema = createSchema.partial();

const COLS: Record<string, string> = {
  childId: 'child_id',
  date: 'date',
  whatWentWell: 'what_went_well',
  areasForDevelopment: 'areas_for_development',
  nextSteps: 'next_steps',
  practitioner: 'practitioner',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM reflections
       WHERE nursery_id=$1
         AND ($2::int IS NULL OR child_id=$2)
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
    client.query('SELECT * FROM reflections WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Reflection not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO reflections
         (nursery_id, child_id, date, what_went_well, areas_for_development, next_steps, practitioner)
       VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6,$7)
       RETURNING *`,
      [
        nurseryId,
        b.childId,
        b.date ?? null,
        b.whatWentWell ?? null,
        b.areasForDevelopment ?? null,
        b.nextSteps ?? null,
        b.practitioner ?? name,
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
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE reflections SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Reflection not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM reflections WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Reflection not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
