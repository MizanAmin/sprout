import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import type { HonoEnv } from '../types';

// Server-enforced email second factor for staff/manager logins. Runs after
// requireAuth on the gated routes. When MFA_ENABLED=true, a manager/staff request
// must carry a valid X-MFA-Token (a short-lived HS256 proof minted by
// /auth/mfa/verify); otherwise it gets 401 MFA_REQUIRED and the staff app routes
// the user to the code-entry step. Parents and admin paths are unaffected.
export function mfaSecret(): Uint8Array {
  const s = process.env.MFA_SECRET;
  if (!s) throw new Error('MFA_SECRET must be set');
  return new TextEncoder().encode(s);
}

export const requireMfa = createMiddleware<HonoEnv>(async (c, next) => {
  if (process.env.MFA_ENABLED !== 'true') return next();

  const user = c.get('user');
  // Only password-based staff logins are second-factored.
  if (!user || (user.role !== 'manager' && user.role !== 'staff')) return next();

  const token = c.req.header('X-MFA-Token');
  if (!token) return c.json({ error: 'Second factor required', code: 'MFA_REQUIRED' }, 401);
  try {
    const { payload } = await jwtVerify(token, mfaSecret(), { algorithms: ['HS256'] });
    if (payload.sub !== user.id || payload.purpose !== 'mfa') throw new Error('invalid');
  } catch {
    return c.json({ error: 'Second factor required', code: 'MFA_REQUIRED' }, 401);
  }
  await next();
});
