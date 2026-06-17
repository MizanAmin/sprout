import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole, requirePlanFeature } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// risk_assessments, risk_assessment_items, policies, policy_signoffs (migration 010).
// Manager-only and gated behind the Blossom+ 'compliance' plan feature. Static
// sub-paths are declared before any '/:id' route so they aren't captured as ids.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'), requirePlanFeature('compliance'));

// ---- Risk assessments ----

const RA_COLS: Record<string, string> = {
  title: 'title',
  location: 'location',
  reviewedBy: 'reviewed_by',
  reviewDate: 'review_date',
  nextReview: 'next_review',
  status: 'status',
};

const raCreateSchema = z.object({
  title: z.string().min(1),
  location: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewDate: z.string().optional(),
  nextReview: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

const raUpdateSchema = raCreateSchema.partial();

app.get('/risk-assessments', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM risk_assessments WHERE nursery_id=$1 ORDER BY created_at DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.get('/risk-assessments/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM risk_assessments WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Risk assessment not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/risk-assessments', zValidator('json', raCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO risk_assessments
         (nursery_id, title, location, reviewed_by, review_date, next_review, status)
       VALUES ($1,$2,COALESCE($3,''),COALESCE($4,''),$5,$6,COALESCE($7,'draft'))
       RETURNING *`,
      [
        nurseryId,
        b.title,
        b.location ?? null,
        b.reviewedBy ?? null,
        b.reviewDate ?? null,
        b.nextReview ?? null,
        b.status ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/risk-assessments/:id', zValidator('json', raUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = RA_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE risk_assessments SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Risk assessment not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/risk-assessments/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM risk_assessments WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Risk assessment not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Risk assessment items ----

const RAI_COLS: Record<string, string> = {
  riskAssessmentId: 'risk_assessment_id',
  hazard: 'hazard',
  whoAffected: 'who_affected',
  existingControls: 'existing_controls',
  likelihood: 'likelihood',
  severity: 'severity',
  additionalControls: 'additional_controls',
  responsiblePerson: 'responsible_person',
  targetDate: 'target_date',
};

const raiCreateSchema = z.object({
  riskAssessmentId: z.number().int(),
  hazard: z.string().min(1),
  whoAffected: z.string().optional(),
  existingControls: z.string().optional(),
  likelihood: z.number().int().min(1).max(5).optional(),
  severity: z.number().int().min(1).max(5).optional(),
  additionalControls: z.string().optional(),
  responsiblePerson: z.string().optional(),
  targetDate: z.string().optional(),
});

const raiUpdateSchema = raiCreateSchema.partial();

app.get('/risk-assessment-items', async (c) => {
  const { nurseryId } = c.get('user');
  const riskAssessmentId = c.req.query('riskAssessmentId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM risk_assessment_items
       WHERE nursery_id=$1
         AND ($2::int IS NULL OR risk_assessment_id=$2)
       ORDER BY id`,
      [nurseryId, riskAssessmentId ?? null],
    ),
  );
  return c.json(rows);
});

app.post('/risk-assessment-items', zValidator('json', raiCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO risk_assessment_items
         (nursery_id, risk_assessment_id, hazard, who_affected, existing_controls,
          likelihood, severity, additional_controls, responsible_person, target_date)
       VALUES ($1,$2,$3,COALESCE($4,''),COALESCE($5,''),COALESCE($6,3),COALESCE($7,3),COALESCE($8,''),COALESCE($9,''),$10)
       RETURNING *`,
      [
        nurseryId,
        b.riskAssessmentId,
        b.hazard,
        b.whoAffected ?? null,
        b.existingControls ?? null,
        b.likelihood ?? null,
        b.severity ?? null,
        b.additionalControls ?? null,
        b.responsiblePerson ?? null,
        b.targetDate ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/risk-assessment-items/:id', zValidator('json', raiUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = RAI_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE risk_assessment_items SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Risk assessment item not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/risk-assessment-items/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM risk_assessment_items WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Risk assessment item not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Policies ----

const POLICY_COLS: Record<string, string> = {
  title: 'title',
  category: 'category',
  content: 'content',
  version: 'version',
  reviewedAt: 'reviewed_at',
  nextReview: 'next_review',
  status: 'status',
};

const policyCreateSchema = z.object({
  title: z.string().min(1),
  category: z.string().optional(),
  content: z.string().optional(),
  version: z.string().optional(),
  reviewedAt: z.string().optional(),
  nextReview: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

const policyUpdateSchema = policyCreateSchema.partial();

app.get('/policies', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM policies WHERE nursery_id=$1 ORDER BY created_at DESC', [nurseryId]),
  );
  return c.json(rows);
});

app.get('/policies/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM policies WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Policy not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/policies', zValidator('json', policyCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO policies
         (nursery_id, title, category, content, version, reviewed_at, next_review, status)
       VALUES ($1,$2,COALESCE($3,''),COALESCE($4,''),COALESCE($5,'1.0'),$6,$7,COALESCE($8,'active'))
       RETURNING *`,
      [
        nurseryId,
        b.title,
        b.category ?? null,
        b.content ?? null,
        b.version ?? null,
        b.reviewedAt ?? null,
        b.nextReview ?? null,
        b.status ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/policies/:id', zValidator('json', policyUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = POLICY_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE policies SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Policy not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/policies/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM policies WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Policy not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Policy signoffs ----

const signoffCreateSchema = z.object({
  policyId: z.number().int(),
  staffName: z.string().min(1),
});

app.get('/policy-signoffs', async (c) => {
  const { nurseryId } = c.get('user');
  const policyId = c.req.query('policyId');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM policy_signoffs
       WHERE nursery_id=$1
         AND ($2::int IS NULL OR policy_id=$2)
       ORDER BY signed_at DESC`,
      [nurseryId, policyId ?? null],
    ),
  );
  return c.json(rows);
});

app.post('/policy-signoffs', zValidator('json', signoffCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO policy_signoffs (nursery_id, policy_id, staff_name)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [nurseryId, b.policyId, b.staffName],
    ),
  );
  return c.json(rows[0], 201);
});

app.delete('/policy-signoffs/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM policy_signoffs WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Policy signoff not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
