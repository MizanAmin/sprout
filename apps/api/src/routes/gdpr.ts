import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// gdpr_settings, sar_requests, erasure_requests, retention_policies,
// privacy_notice_ack (migration 011). Manager-only. Static sub-paths are declared
// before any '/:id' route so they aren't captured as ids.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'), auditLog);

// ---- GDPR settings (one row per nursery) ----

const settingsSchema = z.object({
  dataController: z.string().optional(),
  dpoName: z.string().optional(),
  dpoEmail: z.string().optional(),
  retentionChildren: z.number().int().optional(),
  retentionStaff: z.number().int().optional(),
  retentionCctv: z.number().int().optional(),
  lawfulBasis: z.string().optional(),
  lastAuditDate: z.string().optional(),
  nextAuditDate: z.string().optional(),
  icoRegistered: z.boolean().optional(),
  icoNumber: z.string().optional(),
  privacyNotice: z.string().optional(),
});

app.get('/settings', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM gdpr_settings WHERE nursery_id=$1', [nurseryId]),
  );
  return c.json(rows[0] ?? null);
});

const upsertSettings = zValidator('json', settingsSchema.partial());

const handleSettingsUpsert = async (c: Context<HonoEnv>) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json' as never) as z.infer<typeof settingsSchema>;
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO gdpr_settings
         (nursery_id, data_controller, dpo_name, dpo_email,
          retention_children, retention_staff, retention_cctv,
          lawful_basis, last_audit_date, next_audit_date,
          ico_registered, ico_number, privacy_notice)
       VALUES ($1,COALESCE($2,''),COALESCE($3,''),COALESCE($4,''),
               COALESCE($5,3),COALESCE($6,7),COALESCE($7,30),
               COALESCE($8,'contract'),$9,$10,
               COALESCE($11,false),COALESCE($12,''),COALESCE($13,''))
       ON CONFLICT (nursery_id) DO UPDATE SET
         data_controller    = COALESCE($2, gdpr_settings.data_controller),
         dpo_name           = COALESCE($3, gdpr_settings.dpo_name),
         dpo_email          = COALESCE($4, gdpr_settings.dpo_email),
         retention_children = COALESCE($5, gdpr_settings.retention_children),
         retention_staff    = COALESCE($6, gdpr_settings.retention_staff),
         retention_cctv     = COALESCE($7, gdpr_settings.retention_cctv),
         lawful_basis       = COALESCE($8, gdpr_settings.lawful_basis),
         last_audit_date    = COALESCE($9, gdpr_settings.last_audit_date),
         next_audit_date    = COALESCE($10, gdpr_settings.next_audit_date),
         ico_registered     = COALESCE($11, gdpr_settings.ico_registered),
         ico_number         = COALESCE($12, gdpr_settings.ico_number),
         privacy_notice     = COALESCE($13, gdpr_settings.privacy_notice)
       RETURNING *`,
      [
        nurseryId,
        b.dataController ?? null,
        b.dpoName ?? null,
        b.dpoEmail ?? null,
        b.retentionChildren ?? null,
        b.retentionStaff ?? null,
        b.retentionCctv ?? null,
        b.lawfulBasis ?? null,
        b.lastAuditDate ?? null,
        b.nextAuditDate ?? null,
        b.icoRegistered ?? null,
        b.icoNumber ?? null,
        b.privacyNotice ?? null,
      ],
    ),
  );
  return c.json(rows[0]);
};

app.put('/settings', upsertSettings, handleSettingsUpsert);
app.patch('/settings', upsertSettings, handleSettingsUpsert);

// ---- SAR requests ----

const SAR_COLS: Record<string, string> = {
  requesterName: 'requester_name',
  requesterEmail: 'requester_email',
  subject: 'subject',
  receivedAt: 'received_at',
  dueDate: 'due_date',
  status: 'status',
  notes: 'notes',
  completedAt: 'completed_at',
};

const sarCreateSchema = z.object({
  requesterName: z.string().min(1),
  requesterEmail: z.string().optional(),
  subject: z.string().optional(),
  receivedAt: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['received', 'in_progress', 'completed', 'refused']).optional(),
  notes: z.string().optional(),
  completedAt: z.string().optional(),
});

const sarUpdateSchema = sarCreateSchema.partial();

app.get('/sar', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM sar_requests WHERE nursery_id=$1 ORDER BY created_at DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.get('/sar/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM sar_requests WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'SAR request not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/sar', zValidator('json', sarCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO sar_requests
         (nursery_id, requester_name, requester_email, subject, received_at, due_date, status, notes, completed_at)
       VALUES ($1,$2,COALESCE($3,''),COALESCE($4,''),COALESCE($5,CURRENT_DATE),$6,COALESCE($7,'received'),COALESCE($8,''),$9)
       RETURNING *`,
      [
        nurseryId,
        b.requesterName,
        b.requesterEmail ?? null,
        b.subject ?? null,
        b.receivedAt ?? null,
        b.dueDate ?? null,
        b.status ?? null,
        b.notes ?? null,
        b.completedAt ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/sar/:id', zValidator('json', sarUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = SAR_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE sar_requests SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'SAR request not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/sar/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM sar_requests WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'SAR request not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Erasure requests ----

const ERASURE_COLS: Record<string, string> = {
  dataSubject: 'data_subject',
  email: 'email',
  reason: 'reason',
  requestedAt: 'requested_at',
  dueDate: 'due_date',
  status: 'status',
  completedAt: 'completed_at',
  notes: 'notes',
};

const erasureCreateSchema = z.object({
  dataSubject: z.string().min(1),
  email: z.string().optional(),
  reason: z.string().optional(),
  requestedAt: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'completed', 'refused']).optional(),
  completedAt: z.string().optional(),
  notes: z.string().optional(),
});

const erasureUpdateSchema = erasureCreateSchema.partial();

app.get('/erasure', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM erasure_requests WHERE nursery_id=$1 ORDER BY created_at DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.get('/erasure/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM erasure_requests WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Erasure request not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/erasure', zValidator('json', erasureCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO erasure_requests
         (nursery_id, data_subject, email, reason, requested_at, due_date, status, completed_at, notes)
       VALUES ($1,$2,COALESCE($3,''),COALESCE($4,''),COALESCE($5,CURRENT_DATE),$6,COALESCE($7,'pending'),$8,COALESCE($9,''))
       RETURNING *`,
      [
        nurseryId,
        b.dataSubject,
        b.email ?? null,
        b.reason ?? null,
        b.requestedAt ?? null,
        b.dueDate ?? null,
        b.status ?? null,
        b.completedAt ?? null,
        b.notes ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/erasure/:id', zValidator('json', erasureUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = ERASURE_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE erasure_requests SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Erasure request not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/erasure/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM erasure_requests WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Erasure request not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Retention policies ----

const RETENTION_COLS: Record<string, string> = {
  dataCategory: 'data_category',
  retentionPeriodYears: 'retention_period_years',
  legalBasis: 'legal_basis',
  notes: 'notes',
};

const retentionCreateSchema = z.object({
  dataCategory: z.string().min(1),
  retentionPeriodYears: z.number().int(),
  legalBasis: z.string().optional(),
  notes: z.string().optional(),
});

const retentionUpdateSchema = retentionCreateSchema.partial();

app.get('/retention', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM retention_policies WHERE nursery_id=$1 ORDER BY updated_at DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.get('/retention/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM retention_policies WHERE id=$1 AND nursery_id=$2', [id, nurseryId]),
  );
  if (!rows[0]) return c.json({ error: 'Retention policy not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.post('/retention', zValidator('json', retentionCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO retention_policies
         (nursery_id, data_category, retention_period_years, legal_basis, notes)
       VALUES ($1,$2,$3,COALESCE($4,''),COALESCE($5,''))
       RETURNING *`,
      [
        nurseryId,
        b.dataCategory,
        b.retentionPeriodYears,
        b.legalBasis ?? null,
        b.notes ?? null,
      ],
    ),
  );
  return c.json(rows[0], 201);
});

app.patch('/retention/:id', zValidator('json', retentionUpdateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const b = c.req.valid('json') as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = RETENTION_COLS[k];
    if (!col || v === undefined) continue;
    sets.push(`${col}=$${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return c.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, 422);
  vals.push(id, nurseryId);
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `UPDATE retention_policies SET ${sets.join(', ')} WHERE id=$${i++} AND nursery_id=$${i} RETURNING *`,
      vals,
    ),
  );
  if (!rows[0]) return c.json({ error: 'Retention policy not found', code: 'NOT_FOUND' }, 404);
  return c.json(rows[0]);
});

app.delete('/retention/:id', async (c) => {
  const { nurseryId } = c.get('user');
  const id = c.req.param('id');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('DELETE FROM retention_policies WHERE id=$1 AND nursery_id=$2 RETURNING id', [
      id,
      nurseryId,
    ]),
  );
  if (!rows[0]) return c.json({ error: 'Retention policy not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

// ---- Privacy notice acknowledgements ----

const privacyAckCreateSchema = z.object({
  userId: z.string().uuid().optional(),
  userName: z.string().optional(),
  version: z.string().optional(),
});

app.get('/privacy-ack', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM privacy_notice_ack WHERE nursery_id=$1 ORDER BY acked_at DESC', [
      nurseryId,
    ]),
  );
  return c.json(rows);
});

app.post('/privacy-ack', zValidator('json', privacyAckCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const b = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      `INSERT INTO privacy_notice_ack (nursery_id, user_id, user_name, version)
       VALUES ($1,$2,COALESCE($3,''),COALESCE($4,'1.0'))
       RETURNING *`,
      [nurseryId, b.userId ?? null, b.userName ?? null, b.version ?? null],
    ),
  );
  return c.json(rows[0], 201);
});

// ---- Audit log ----

app.get('/audit', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      'SELECT * FROM audit_log WHERE nursery_id=$1 ORDER BY created_at DESC LIMIT 100',
      [nurseryId],
    ),
  );
  return c.json(rows);
});

export default app;
