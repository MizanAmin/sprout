// Barrel re-export so route/middleware files import DB access from one place:
//   import { withTenant, pool, supabaseAdmin } from '../db';
export { supabaseAdmin, getSupabaseAdmin } from '@sprout/db/admin';
export { pool, withTenant } from '@sprout/db/pool';
export type { TenantClaims } from '@sprout/db/pool';
