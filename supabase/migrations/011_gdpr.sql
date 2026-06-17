CREATE TABLE gdpr_settings (
  id                  SERIAL PRIMARY KEY,
  nursery_id          INTEGER NOT NULL UNIQUE REFERENCES nurseries(id) ON DELETE CASCADE,
  data_controller     TEXT    DEFAULT '',
  dpo_name            TEXT    DEFAULT '',
  dpo_email           TEXT    DEFAULT '',
  retention_children  INTEGER NOT NULL DEFAULT 3,
  retention_staff     INTEGER NOT NULL DEFAULT 7,
  retention_cctv      INTEGER NOT NULL DEFAULT 30,
  lawful_basis        TEXT    NOT NULL DEFAULT 'contract',
  last_audit_date     DATE,
  next_audit_date     DATE
);

CREATE TABLE sar_requests (
  id              SERIAL PRIMARY KEY,
  nursery_id      INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  requester_name  TEXT    NOT NULL,
  requester_email TEXT    DEFAULT '',
  subject         TEXT    DEFAULT '',
  received_at     DATE    NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  status          TEXT    NOT NULL DEFAULT 'received'
                          CHECK(status IN ('received','in_progress','completed','refused')),
  notes           TEXT    DEFAULT '',
  completed_at    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE erasure_requests (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  data_subject TEXT    NOT NULL,
  email        TEXT    DEFAULT '',
  reason       TEXT    DEFAULT '',
  requested_at DATE    NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE,
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','refused')),
  completed_at DATE,
  notes        TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE retention_policies (
  id                      SERIAL PRIMARY KEY,
  nursery_id              INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  data_category           TEXT    NOT NULL,
  retention_period_years  INTEGER NOT NULL,
  legal_basis             TEXT    DEFAULT '',
  notes                   TEXT    DEFAULT '',
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE privacy_notice_ack (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT    DEFAULT '',
  version     TEXT    NOT NULL DEFAULT '1.0',
  acked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
