-- Fire drill register (safety/compliance). One row per recorded fire drill.
CREATE TABLE fire_drills (
  id               SERIAL PRIMARY KEY,
  nursery_id       INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  date             DATE    NOT NULL,
  time             TEXT,
  drill_type       TEXT    NOT NULL DEFAULT 'scheduled',
  evacuation_time  TEXT,
  persons_present  INTEGER,
  all_clear        BOOLEAN NOT NULL DEFAULT TRUE,
  issues           TEXT    DEFAULT '',
  conducted_by     TEXT    DEFAULT '',
  notes            TEXT    DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX fire_drills_nursery_date_idx ON fire_drills (nursery_id, date DESC);

-- Tenant isolation, matching the pattern in 013_rls_policies.sql.
ALTER TABLE fire_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE fire_drills FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fire_drills_tenant_isolation ON fire_drills;
CREATE POLICY fire_drills_tenant_isolation ON fire_drills
  USING (nursery_id = public.current_nursery_id());

-- Grants (mirrors 014_app_user_role.sql). Default privileges set there cover
-- tables created later, but grant explicitly to be safe.
GRANT SELECT, INSERT, UPDATE, DELETE ON fire_drills TO app_user;
GRANT USAGE, SELECT ON SEQUENCE fire_drills_id_seq TO app_user;
GRANT SELECT ON fire_drills TO authenticated;
