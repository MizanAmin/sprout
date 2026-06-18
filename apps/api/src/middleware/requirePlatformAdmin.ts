import { createMiddleware } from 'hono/factory';
import { verifySupabaseJwt } from './auth';

// Platform super-admin gate for /api/admin/*. A real Supabase login (any
// authenticated user) plus an email allowlist: only emails listed in ADMIN_EMAILS
// (comma-separated) may access cross-tenant admin. Replaces the old shared
// X-Admin-Key. The same JWT verification (JWKS / ES256) as tenant auth is reused.
function allowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const requirePlatformAdmin = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

  let email: string | undefined;
  try {
    const payload = await verifySupabaseJwt(token);
    email = payload.email?.toLowerCase();
  } catch {
    return c.json({ error: 'Invalid token', code: 'UNAUTHORIZED' }, 401);
  }

  const allowed = allowlist();
  if (!email || allowed.size === 0 || !allowed.has(email)) {
    return c.json(
      { error: 'Not authorised for platform admin', code: 'FORBIDDEN' },
      403,
    );
  }
  await next();
});
