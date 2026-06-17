import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole, requirePlanFeature } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// staff_training, staff_appraisals, qualifications, wellbeing_checkins
// (migration 010). Manager-only and gated behind the 'staffDev' plan feature.
// Static sub-paths are declared before any '/:id' route so they aren't captured
// as ids.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'), requirePlanFeature('staffDev'));

// ---- Training ----

const TRAINING_COLS: Record<string, string> = {
  staffId: 'staff_id',
  staffName: 'staff_name',
  courseName: 'course_name',
  provider: 'provider',
  completedDate: 'completed_date',
  expiryDate: 'expiry_date',
  certificateUrl: 'certificate_url',
  status: 'status',
  hours: 'hours',
  trainingType: 'training_type',
  notes: 'notes',
};

const trainingCreateSchema = z.object({
  staffId: z.number().int().optional(),
  staffName: z.string().optional(),
  courseName: z.string().min(1),
  provider: z.string().optional(),
  completedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  certificateUrl: z.string().optional(),
  status: z.enum(['planned', 'completed', 'expired']).optional(),
  hours: z.number().optional(),
  trainingType: z.string().optional(),
  notes: z.string().optional(),
});

const trainingUpdateSchema = trainingCreateSchema.partial();

app.get('/training', async (c) => {
  const { nurseryId } = c.get('user');
  const expiringSoon = c.req.query('expiringSoon');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM staff_training
       WHERE nursery_id=$1
         AND ($2::boolean IS NOT TRUE
              OR (expiry_date IS NOT NULL
                  AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'))
       ORDER BY expiry_date NULLS LAST, created_at DESC`,
      [nurseryId, expiringSoon ? true : null],
    ),
  );
  return c.json(rows);
});

app.get('/training/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM staff_training WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Training record not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/training', zValidator('json', trainingCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO staff_training
         (nursery_id, staff_id, staff_name, course_name, provider, completed_date, expiry_date, certificate_url, status, hours, training_type, notes)
       VALUES ($1,$2,COALESCE($3,''),$4,COALESCE($5,''),$6,$7,COALESCE($8,''),COALESCE($9,'completed'),$10,COALESCE($11,''),COALESCE($12,''))
       RETURNING *`,
      [
        nurseryId,
        b.staffId ?? null,
        b.staffName ?? null,
        b.courseName,
        b.provider ?? null,
        b.completedDate ?? null,
        b.expiryDate ?? null,
        b.certificateUrl ?? null,
        b.status ?? null,
        b.hours ?? null,
        b.trainingType ?? null,
        b.notes ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/training/:id', zValidator('json', trainingUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = TRAINING_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE staff_training SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Training record not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/training/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM staff_training WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Training record not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Appraisals ----

const APPRAISAL_COLS: Record<string, string> = {
  staffId: 'staff_id',
  staffName: 'staff_name',
  date: 'date',
  appraiser: 'appraiser',
  strengths: 'strengths',
  areasForDev: 'areas_for_dev',
  targets: 'targets',
  nextReview: 'next_review',
  period: 'period',
  overallRating: 'overall_rating',
};

const appraisalCreateSchema = z.object({
  staffId: z.number().int().optional(),
  staffName: z.string().optional(),
  date: z.string().optional(),
  appraiser: z.string().optional(),
  strengths: z.string().optional(),
  areasForDev: z.string().optional(),
  targets: z.string().optional(),
  nextReview: z.string().optional(),
  period: z.string().optional(),
  overallRating: z.string().optional(),
});

const appraisalUpdateSchema = appraisalCreateSchema.partial();

app.get('/appraisals', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM staff_appraisals WHERE nursery_id=$1 ORDER BY date DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.get('/appraisals/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM staff_appraisals WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Appraisal not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/appraisals', zValidator('json', appraisalCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO staff_appraisals
         (nursery_id, staff_id, staff_name, date, appraiser, strengths, areas_for_dev, targets, next_review, period, overall_rating)
       VALUES ($1,$2,COALESCE($3,''),COALESCE($4,CURRENT_DATE),COALESCE($5,''),COALESCE($6,''),COALESCE($7,''),COALESCE($8,''),$9,COALESCE($10,''),COALESCE($11,''))
       RETURNING *`,
      [
        nurseryId,
        b.staffId ?? null,
        b.staffName ?? null,
        b.date ?? null,
        b.appraiser ?? null,
        b.strengths ?? null,
        b.areasForDev ?? null,
        b.targets ?? null,
        b.nextReview ?? null,
        b.period ?? null,
        b.overallRating ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/appraisals/:id', zValidator('json', appraisalUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = APPRAISAL_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE staff_appraisals SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Appraisal not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/appraisals/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM staff_appraisals WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Appraisal not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Qualifications ----

const QUAL_COLS: Record<string, string> = {
  staffId: 'staff_id',
  staffName: 'staff_name',
  qualification: 'qualification',
  awardingBody: 'awarding_body',
  dateAchieved: 'date_achieved',
  expiryDate: 'expiry_date',
  level: 'level',
  certificateUrl: 'certificate_url',
};

const qualCreateSchema = z.object({
  staffId: z.number().int().optional(),
  staffName: z.string().optional(),
  qualification: z.string().min(1),
  awardingBody: z.string().optional(),
  dateAchieved: z.string().optional(),
  expiryDate: z.string().optional(),
  level: z.string().optional(),
  certificateUrl: z.string().optional(),
});

const qualUpdateSchema = qualCreateSchema.partial();

app.get('/qualifications', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM qualifications WHERE nursery_id=$1 ORDER BY created_at DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.get('/qualifications/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM qualifications WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Qualification not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/qualifications', zValidator('json', qualCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO qualifications
         (nursery_id, staff_id, staff_name, qualification, awarding_body, date_achieved, expiry_date, level, certificate_url)
       VALUES ($1,$2,COALESCE($3,''),$4,COALESCE($5,''),$6,$7,COALESCE($8,''),COALESCE($9,''))
       RETURNING *`,
      [
        nurseryId,
        b.staffId ?? null,
        b.staffName ?? null,
        b.qualification,
        b.awardingBody ?? null,
        b.dateAchieved ?? null,
        b.expiryDate ?? null,
        b.level ?? null,
        b.certificateUrl ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/qualifications/:id', zValidator('json', qualUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = QUAL_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE qualifications SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Qualification not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/qualifications/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM qualifications WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Qualification not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Wellbeing check-ins ----

const WELLBEING_COLS: Record<string, string> = {
  staffId: 'staff_id',
  staffName: 'staff_name',
  date: 'date',
  mood: 'mood',
  workload: 'workload',
  support: 'support',
  notes: 'notes',
};

const wellbeingCreateSchema = z.object({
  staffId: z.number().int().optional(),
  staffName: z.string().optional(),
  date: z.string().optional(),
  mood: z.number().int().min(1).max(5),
  workload: z.number().int().min(1).max(5),
  support: z.number().int().min(1).max(5),
  notes: z.string().optional(),
});

const wellbeingUpdateSchema = wellbeingCreateSchema.partial();

app.get('/wellbeing', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM wellbeing_checkins WHERE nursery_id=$1 ORDER BY date DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.get('/wellbeing/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM wellbeing_checkins WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Wellbeing check-in not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/wellbeing', zValidator('json', wellbeingCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO wellbeing_checkins
         (nursery_id, staff_id, staff_name, date, mood, workload, support, notes)
       VALUES ($1,$2,COALESCE($3,''),COALESCE($4,CURRENT_DATE),$5,$6,$7,COALESCE($8,''))
       RETURNING *`,
      [
        nurseryId,
        b.staffId ?? null,
        b.staffName ?? null,
        b.date ?? null,
        b.mood,
        b.workload,
        b.support,
        b.notes ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/wellbeing/:id', zValidator('json', wellbeingUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = WELLBEING_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE wellbeing_checkins SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Wellbeing check-in not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/wellbeing/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM wellbeing_checkins WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Wellbeing check-in not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
