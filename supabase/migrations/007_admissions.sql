CREATE TABLE enquiries (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_name   TEXT    NOT NULL,
  parent_name  TEXT    DEFAULT '',
  email        TEXT    DEFAULT '',
  phone        TEXT    DEFAULT '',
  dob          DATE,
  room         TEXT    DEFAULT '',
  start_date   DATE,
  priority     TEXT    NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Low','Normal','High','Urgent')),
  status       TEXT    NOT NULL DEFAULT 'New'
                       CHECK(status IN ('New','Contacted','Toured','Offered','Enrolled','Declined')),
  notes        TEXT    DEFAULT '',
  source       TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE waiting_list (
  id             SERIAL PRIMARY KEY,
  nursery_id     INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_name     TEXT    NOT NULL,
  parent_name    TEXT    DEFAULT '',
  email          TEXT    DEFAULT '',
  phone          TEXT    DEFAULT '',
  dob            DATE,
  desired_start  DATE,
  room           TEXT    DEFAULT '',
  days_required  TEXT    DEFAULT '',
  notes          TEXT    DEFAULT '',
  position       INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'waiting'
                         CHECK(status IN ('waiting','offered','enrolled','withdrawn')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
