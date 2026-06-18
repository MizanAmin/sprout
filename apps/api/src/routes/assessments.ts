import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { assessmentCreateSchema, assessmentUpdateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// assessments (migration 004) — EYFS area scores (1–5) per child.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const COLS: Record<string, string> = {
  childId: 'child_id',
  area: 'area',
  score: 'score',
  notes: 'notes',
  practitioner: 'practitioner',
  assessedAt: 'assessed_at',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM assessments
       WHERE nursery_id=$1 AND ($2::int IS NULL OR child_id=$2)
       ORDER BY assessed_at DESC, id DESC`,
      [nurseryId, childId ?? null],
    ),
  );
  return c.json(rows);
});

app.get('/all', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT a.*, ch.name AS child_name
       FROM assessments a
       JOIN children ch ON ch.id = a.child_id
       WHERE a.nursery_id = $1
       ORDER BY ch.name, a.assessed_at DESC`,
      [nurseryId],
    ),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM assessments WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Assessment not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', assessmentCreateSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO assessments (nursery_id, child_id, area, score, notes, practitioner, assessed_at)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date, CURRENT_DATE))
       RETURNING *`,
      [nurseryId, b.childId, b.area, b.score, b.notes ?? '', b.practitioner ?? name, b.assessedAt ?? null],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', assessmentUpdateSchema), async (c) => {
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
      `UPDATE assessments SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Assessment not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM assessments WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Assessment not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
