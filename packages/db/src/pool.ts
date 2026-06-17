import { Pool, type PoolClient } from 'pg';

// pg connection pool + withTenant() — API server ONLY, never imported by apps.
// Every database-writing or multi-table query runs inside withTenant so RLS is
// enforced via the app_user role even over pooled connections.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Identity the RLS helpers (public.current_nursery_id / jwt_role / jwt_child_ids)
// read from GUCs on this connection. Omit `role` for trusted staff/server calls
// (treated as non-parent → full nursery scope); pass role:'parent' + childIds to
// scope a request to a parent's own children, matching the JWT path.
export interface TenantClaims {
  role?: string;
  childIds?: number[];
}

export async function withTenant<T>(
  nurseryId: number,
  fn: (client: PoolClient) => Promise<T>,
  claims?: TenantClaims,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE app_user');
    await client.query("SELECT set_config('app.current_nursery_id', $1, true)", [
      String(nurseryId),
    ]);
    if (claims?.role !== undefined) {
      await client.query("SELECT set_config('app.current_role', $1, true)", [
        claims.role,
      ]);
    }
    if (claims?.childIds !== undefined) {
      await client.query("SELECT set_config('app.current_child_ids', $1, true)", [
        JSON.stringify(claims.childIds),
      ]);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
