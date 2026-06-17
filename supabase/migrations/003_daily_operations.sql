CREATE TABLE attendance (
  id            SERIAL PRIMARY KEY,
  nursery_id    INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date          DATE    NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT    NOT NULL DEFAULT 'absent' CHECK(status IN ('present','absent','late')),
  sign_in       TIME,
  sign_out      TIME,
  absent_reason TEXT    DEFAULT '',
  signed_in_by  TEXT    DEFAULT '',
  collected_by  TEXT    DEFAULT '',
  att_notes     TEXT    DEFAULT '',
  UNIQUE(child_id, date)
);

CREATE TABLE daily_logs (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id    INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  time        TIME,
  type        TEXT    NOT NULL CHECK(type IN ('meal','sleep','nappy','mood','activity','note')),
  details     TEXT    DEFAULT '',
  added_by    TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE medications (
  id              SERIAL PRIMARY KEY,
  nursery_id      INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id        INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  medication_name TEXT    NOT NULL,
  dose            TEXT    DEFAULT '',
  dose_given      TEXT    DEFAULT '',
  frequency       TEXT    DEFAULT '',
  route           TEXT    DEFAULT '',
  prescribed_by   TEXT    DEFAULT '',
  start_date      DATE,
  end_date        DATE,
  given_by        TEXT    DEFAULT '',
  witness_by      TEXT    DEFAULT '',
  time_given      TIMESTAMPTZ,
  refused_reason  TEXT    DEFAULT '',
  notes           TEXT    DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE incidents (
  id                SERIAL PRIMARY KEY,
  nursery_id        INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id          INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name        TEXT    DEFAULT '',
  date              DATE    NOT NULL DEFAULT CURRENT_DATE,
  time              TIME,
  type              TEXT    DEFAULT '',
  location          TEXT    DEFAULT '',
  description       TEXT    DEFAULT '',
  action_taken      TEXT    DEFAULT '',
  witness           TEXT    DEFAULT '',
  reported_by       TEXT    DEFAULT '',
  parent_informed   BOOLEAN NOT NULL DEFAULT FALSE,
  parent_informed_at TIMESTAMPTZ,
  signed_by         TEXT    DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accident_book (
  id                SERIAL PRIMARY KEY,
  nursery_id        INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id          INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name        TEXT    DEFAULT '',
  date              DATE    NOT NULL DEFAULT CURRENT_DATE,
  time              TIME,
  location          TEXT    DEFAULT '',
  description       TEXT    DEFAULT '',
  injury_type       TEXT    DEFAULT '',
  body_part         TEXT    DEFAULT '',
  first_aid_given   TEXT    DEFAULT '',
  first_aider       TEXT    DEFAULT '',
  witness           TEXT    DEFAULT '',
  parent_notified_at TIMESTAMPTZ,
  follow_up         TEXT    DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE calendar_events (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  start_date  DATE    NOT NULL,
  end_date    DATE,
  all_day     BOOLEAN NOT NULL DEFAULT TRUE,
  color       TEXT    NOT NULL DEFAULT '#4f8ef7',
  description TEXT    DEFAULT '',
  created_by  TEXT    DEFAULT ''
);

CREATE TABLE nursery_events (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT    DEFAULT '',
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_by  TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
