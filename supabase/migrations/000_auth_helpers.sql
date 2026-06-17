-- Unified tenant/identity accessors used by every RLS policy.
--
-- Two access paths populate identity differently:
--   • Hono API via pg Pool + `SET LOCAL ROLE app_user` sets GUCs
--     (app.current_nursery_id / app.current_role / app.current_child_ids)
--     through withTenant().
--   • Supabase PostgREST + Realtime (role `authenticated`) carries identity in
--     the JWT, readable via auth.jwt().
--
-- Each helper reads the GUC first, then falls back to the JWT, so the SAME
-- policy works on both paths. SECURITY DEFINER (owned by the migration role,
-- which has USAGE on the auth schema) lets app_user call auth.jwt() indirectly
-- without being granted auth-schema access itself. SET search_path = '' hardens
-- the definer functions, so all non-builtin refs are schema-qualified.

CREATE OR REPLACE FUNCTION public.current_nursery_id() RETURNS integer
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_nursery_id', true), '')::int,
    (auth.jwt() -> 'user_metadata' ->> 'nursery_id')::int
  );
$$;

CREATE OR REPLACE FUNCTION public.jwt_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_role', true), ''),
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
$$;

-- Returns a JSONB array of NUMBERS regardless of how child_ids is represented.
-- The API GUC path already stores numbers; the JWT path is normalised here by
-- casting each element through text→int, so a JWT that mints child_ids as
-- strings (["1","2"]) still matches `@> to_jsonb(child_id::int)` in the policies.
CREATE OR REPLACE FUNCTION public.jwt_child_ids() RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(elem::int)
      FROM jsonb_array_elements_text(
        COALESCE(
          NULLIF(current_setting('app.current_child_ids', true), '')::jsonb,
          auth.jwt() -> 'user_metadata' -> 'child_ids',
          '[]'::jsonb
        )
      ) AS elem
    ),
    '[]'::jsonb
  );
$$;

-- EXECUTE is granted to PUBLIC by default. Explicit grants to app_user /
-- authenticated live in migration 014, where the app_user role is created.
