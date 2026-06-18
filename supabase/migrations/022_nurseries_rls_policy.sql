-- nurseries had ROW LEVEL SECURITY enabled but NO policy, so the API's app_user
-- role read 0 rows — breaking Settings, billing status, parent profile, and any
-- other nursery-row read via withTenant. Add a tenant policy keyed on the
-- table's own id (its tenant key), mirroring the *_tenant_isolation pattern.
DROP POLICY IF EXISTS nurseries_tenant_isolation ON nurseries;
CREATE POLICY nurseries_tenant_isolation ON nurseries
  USING (id = public.current_nursery_id());

GRANT SELECT, UPDATE ON nurseries TO app_user;
GRANT SELECT ON nurseries TO authenticated;
