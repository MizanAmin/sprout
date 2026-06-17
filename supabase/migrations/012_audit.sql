CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT    DEFAULT '',
  action      TEXT    NOT NULL,
  table_name  TEXT    DEFAULT '',
  record_id   INTEGER,
  details     JSONB   NOT NULL DEFAULT '{}',
  ip_address  TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
