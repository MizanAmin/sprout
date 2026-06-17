DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- The API connects as `postgres` and switches to app_user per request via
-- withTenant's `SET LOCAL ROLE app_user`. In PG16+ membership alone is not
-- enough — the connecting role needs the SET privilege on app_user. Grant it to
-- postgres (the connection role) so SET ROLE succeeds. WITH INHERIT FALSE keeps
-- postgres from passively inheriting app_user's (more limited) rights.
GRANT app_user TO postgres WITH SET TRUE, INHERIT FALSE;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Frontend / Realtime path: the staff & parent apps use the Supabase JS client
-- (PostgREST + Realtime, role `authenticated`). They need read access; RLS still
-- confines rows to the tenant/parent. Writes go through the Hono API as app_user,
-- so authenticated gets SELECT only.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO authenticated;

-- Identity helpers (created in 000_auth_helpers, before app_user existed).
GRANT EXECUTE ON FUNCTION
  public.current_nursery_id(),
  public.jwt_role(),
  public.jwt_child_ids()
  TO app_user, authenticated;
