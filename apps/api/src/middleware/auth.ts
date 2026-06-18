import { createMiddleware } from 'hono/factory';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { AuthUser, HonoEnv } from '../types';

// Shape of the relevant Supabase JWT claims. Custom claims live in user_metadata
// (see "Custom claims in user_metadata" — set on sign-up / role change).
type SupabaseJwtPayload = {
  sub: string;
  email?: string;
  user_metadata?: {
    nursery_id?: number | string;
    role?: AuthUser['role'];
    name?: string;
    child_ids?: Array<number | string>;
  };
};

// Supabase signs access tokens with the project's CURRENT signing key. New
// projects use asymmetric keys (ES256/RS256) and publish the public keys at the
// JWKS endpoint; older projects use a shared HS256 secret. Verify against JWKS
// first (the modern path), falling back to HS256 + JWT_SECRET for legacy projects.
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (_jwks) return _jwks;
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL must be set');
  _jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  return _jwks;
}

export async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload> {
  try {
    const { payload } = await jwtVerify(token, getJwks());
    return payload as SupabaseJwtPayload;
  } catch (err) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw err;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    });
    return payload as SupabaseJwtPayload;
  }
}

export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  try {
    const payload = await verifySupabaseJwt(token);
    const nurseryId = Number(payload.user_metadata?.nursery_id);
    const role = payload.user_metadata?.role as AuthUser['role'];
    // Reject tokens missing the custom claims rather than letting NaN/undefined
    // flow downstream (which would 500 on the first query).
    if (!payload.sub || !Number.isInteger(nurseryId) || !role) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }
    c.set('user', {
      id: payload.sub,
      nurseryId,
      role,
      name: payload.user_metadata?.name ?? '',
      childIds: (payload.user_metadata?.child_ids ?? []).map(Number),
    });
    await next();
  } catch {
    return c.json({ error: 'Invalid token', code: 'UNAUTHORIZED' }, 401);
  }
});
