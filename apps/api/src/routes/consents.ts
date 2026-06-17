import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  consentTemplateCreateSchema as templateCreateSchema,
  consentTemplateUpdateSchema as templateUpdateSchema,
  consentFormCreateSchema as formCreateSchema,
  consentFormUpdateSchema as formUpdateSchema,
} from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// consent_templates + consent_forms (migration 009). Manager-only on the staff
// side; parents sign forms via parent.ts. Template routes are declared before the
// form '/:id' route so '/templates' isn't captured as an id.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'), auditLog);

// ---- Templates ----

const TEMPLATE_COLS: Record<string, string> = {
  title: 'title',
  body: 'body',
  version: 'version',
  active: 'active',
  requiresSignature: 'requires_signature',
  category: 'category',
};

app.get('/templates', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM consent_templates WHERE nursery_id=$1 ORDER BY created_at DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.post('/templates', zValidator('json', templateCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO consent_templates (nursery_id, title, body, version, active, requires_signature, category)
       VALUES ($1,$2,$3,COALESCE($4,'1.0'),COALESCE($5,true),COALESCE($6,true),$7)
       RETURNING *`,
      [
        nurseryId,
        b.title,
        b.body,
        b.version ?? null,
        b.active ?? null,
        b.requiresSignature ?? null,
        b.category ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/templates/:id', zValidator('json', templateUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = TEMPLATE_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE consent_templates SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Template not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/templates/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM consent_templates WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Template not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Forms ----

const FORM_COLS: Record<string, string> = {
  templateId: 'template_id',
  childId: 'child_id',
  childName: 'child_name',
  signedBy: 'signed_by',
  signatureData: 'signature_data',
  status: 'status',
  dueDate: 'due_date',
};

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const childId = c.req.query('childId');
  const status = c.req.query('status');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `SELECT * FROM consent_forms
       WHERE nursery_id=$1
         AND ($2::int IS NULL OR child_id=$2)
         AND ($3::text IS NULL OR status=$3)
       ORDER BY created_at DESC`,
      [nurseryId, childId ?? null, status ?? null],
    ),
  );
  return c.json(rows);
});

app.get('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM consent_forms WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Consent form not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/', zValidator('json', formCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO consent_forms
         (nursery_id, template_id, child_id, child_name, signed_by, signature_data, status, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'pending'),$8)
       RETURNING *`,
      [
        nurseryId,
        b.templateId ?? null,
        b.childId ?? null,
        b.childName ?? '',
        b.signedBy ?? '',
        b.signatureData ?? '',
        b.status ?? null,
        b.dueDate ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/:id', zValidator('json', formUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = FORM_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  // When marking a form signed, stamp signed_at server-side.
  if (b.status === 'signed') sets.push(`signed_at=NOW()`);
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE consent_forms SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Consent form not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM consent_forms WHERE id=$1 AND nursery_id=$2 RETURNING id', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Consent form not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
