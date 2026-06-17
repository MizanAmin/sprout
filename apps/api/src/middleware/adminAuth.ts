import { createMiddleware } from 'hono/factory';
import { timingSafeEqual } from 'node:crypto';

// Guards the platform super-admin routes (admin.ts) with a shared secret sent in
// the `X-Admin-Key` header — separate from the Supabase JWT user auth. Set
// ADMIN_API_KEY in the API environment; requests without a matching key get 401.
export const adminAuth = createMiddleware(async (c, next) => {
  const expected = process.env.ADMIN_API_KEY;
  const provided = c.req.header('X-Admin-Key');
  if (!expected || !provided || !safeEqual(provided, expected)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }
  await next();
});

// Constant-time comparison; bails on length mismatch (lengths aren't secret).
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
