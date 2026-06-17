import { createMiddleware } from 'hono/factory';
import { pool } from '@sprout/db/pool'; // required by requirePlanFeature
import type { HonoEnv } from '../types';

type Role = 'manager' | 'staff' | 'parent';
type PlanFeature = 'autoInvoice' | 'compliance' | 'staffDev' | 'ai';

const PLAN_FEATURES: Record<string, Record<PlanFeature, boolean>> = {
  seedling: { autoInvoice: false, compliance: false, staffDev: false, ai: false },
  blossom: { autoInvoice: true, compliance: true, staffDev: true, ai: false },
  grove: { autoInvoice: true, compliance: true, staffDev: true, ai: true },
  forest: { autoInvoice: true, compliance: true, staffDev: true, ai: true },
};

// Role check — pass one or more allowed roles
export function requireRole(...roles: Role[]) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user');
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }
    await next();
  });
}

// Plan-feature check — use alongside requireRole for gated features
export function requirePlanFeature(feature: PlanFeature) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const { rows } = await pool.query('SELECT plan FROM nurseries WHERE id=$1', [
      c.get('user').nurseryId,
    ]);
    const plan = rows[0]?.plan ?? 'seedling';
    if (!PLAN_FEATURES[plan]?.[feature]) {
      return c.json(
        {
          error: `This feature requires a higher plan`,
          code: 'PLAN_UPGRADE_REQUIRED',
          requiredFeature: feature,
        },
        402,
      );
    }
    await next();
  });
}
