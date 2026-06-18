-- Structured rota: one row per shift (replaces the denormalized rota.mon..sun
-- free-text columns). Enables shift type, real times, room and notes per shift.
CREATE TABLE rota_shifts (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_id    INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  staff_name  TEXT    NOT NULL DEFAULT '',
  date        DATE    NOT NULL,
  type        TEXT    NOT NULL DEFAULT 'work',  -- work | holiday | sick | training | off
  start_time  TEXT,
  end_time    TEXT,
  room        TEXT    DEFAULT '',
  notes       TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX rota_shifts_nursery_date_idx ON rota_shifts (nursery_id, date);
CREATE INDEX rota_shifts_staff_idx ON rota_shifts (staff_id);

-- Tenant isolation (matches the pattern in 013_rls_policies.sql).
ALTER TABLE rota_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rota_shifts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rota_shifts_tenant_isolation ON rota_shifts;
CREATE POLICY rota_shifts_tenant_isolation ON rota_shifts
  USING (nursery_id = public.current_nursery_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON rota_shifts TO app_user;
GRANT USAGE, SELECT ON SEQUENCE rota_shifts_id_seq TO app_user;
GRANT SELECT ON rota_shifts TO authenticated;
