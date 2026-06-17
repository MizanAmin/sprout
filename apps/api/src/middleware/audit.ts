import { createMiddleware } from 'hono/factory';
import type { HonoEnv } from '../types';
import { pool } from '@sprout/db/pool';

// GDPR requires an audit trail of who accessed or modified what. Apply to any
// route that reads PII or modifies records. Writes asynchronously after the
// response is sent, so it never blocks or breaks the request.
//
// Columns map to the audit_log table (migration 012):
//   action     ← HTTP method
//   table_name ← matched route path (e.g. '/children/:id')
//   record_id  ← :id path param (INTEGER), or NULL if absent/non-numeric
//   details    ← JSONB; carries the response status code
//   ip_address ← forwarded client IP
export const auditLog = createMiddleware<HonoEnv>(async (c, next) => {
  await next();
  // Fire-and-forget — do not await; response is already sent
  const user = c.get('user');
  if (!user) return;
  const rawId = c.req.param('id');
  const recordId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;
  pool
    .query(
      `INSERT INTO audit_log (nursery_id, user_id, user_name, action, table_name, record_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.nurseryId,
        user.id,
        user.name,
        c.req.method, // 'GET' | 'POST' | 'PATCH' | 'DELETE'
        c.req.routePath, // e.g. '/children/:id'
        recordId,
        JSON.stringify({ status_code: c.res.status }),
        c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip') ?? null,
      ],
    )
    .catch(() => {}); // silent — audit failure must never break the API
});
