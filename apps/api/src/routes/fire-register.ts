import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// fire_drills (migration 017) — recorded fire drills.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'));

const createSchema = z.object({
  date: z.string(),
  time: z.string().optional(),
  drillType: z.string().optional(),
  evacuationTime: z.string().optional(),
  personsPresent: z.number().int().optional(),
  allClear: z.boolean().optional(),
  issues: z.string().optional(),
  conductedBy: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

const COLS: Record<string, string> = {
  date: 'date',
  time: 'time',
  drillType: 'drill_type',
  evacuationTime: 'evacuation_time',
  personsPresent: 'persons_present',
  allClear: 'all_clear',
  issues: 'issues',
  conductedBy: 'conducted_by',
  notes: 'notes',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM fire_drills WHERE nursery_id=$1 ORDER BY date DESC, id DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM fire_drills WHERE id=$1 AND nursery_id=$2', [
      c.req.param('id'),
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Drill not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const { nurseryId, name } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO fire_drills
         (nursery_id, date, time, drill_type, evacuation_time, persons_present,
          all_clear, issues, conducted_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        nurseryId,
        b.date,
        b.time ?? null,
        b.drillType ?? 'scheduled',
        b.evacuationTime ?? null,
        b.personsPresent ?? null,
        b.allClear ?? true,
        b.issues ?? '',
        b.conductedBy ?? name,
        b.notes ?? '',
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [key, col] of Object.entries(COLS)) {
    if (key in b) {
      vals.push((b as Record<string, unknown>)[key]);
      sets.push(`${col}=$${vals.length}`);
    }
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(c.req.param('id'), nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE fire_drills SET ${sets.join(', ')}
       WHERE id=$${vals.length - 1} AND nursery_id=$${vals.length} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Drill not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM fire_drills WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      c.req.param('id'),
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Drill not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
