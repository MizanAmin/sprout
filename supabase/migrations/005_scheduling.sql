-- child_sessions: single source of truth for all bookings (recurring + one-off)
-- Recurring: end_date IS NULL or end_date > today
-- One-off:   end_date = start_date
CREATE TABLE child_sessions (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day          TEXT    NOT NULL CHECK(day IN ('Mon','Tue','Wed','Thu','Fri')),
  session_type TEXT    NOT NULL DEFAULT 'Full Day'
                       CHECK(session_type IN ('AM','PM','Full Day','Custom')),
  start_time   TIME,
  end_time     TIME,
  funded_hours NUMERIC NOT NULL DEFAULT 0,
  fee_hours    NUMERIC NOT NULL DEFAULT 0,
  room         TEXT    DEFAULT '',
  start_date   DATE    NOT NULL,
  end_date     DATE,
  notes        TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rota (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_name  TEXT    NOT NULL,
  week_start  DATE    NOT NULL,
  mon         TEXT    DEFAULT '',
  tue         TEXT    DEFAULT '',
  wed         TEXT    DEFAULT '',
  thu         TEXT    DEFAULT '',
  fri         TEXT    DEFAULT '',
  UNIQUE(nursery_id, staff_name, week_start)
);

CREATE TABLE booking_requests (
  id            SERIAL PRIMARY KEY,
  nursery_id    INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id      INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name    TEXT    DEFAULT '',
  week_start    DATE,
  day           TEXT    DEFAULT '',
  session_type  TEXT    DEFAULT '',
  room          TEXT    DEFAULT '',
  parent_note   TEXT    DEFAULT '',
  capacity_note TEXT    DEFAULT '',
  status        TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
  decided_by    TEXT    DEFAULT '',
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE holiday_credit_requests (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id    INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name  TEXT    DEFAULT '',
  start_date  DATE    NOT NULL,
  end_date    DATE    NOT NULL,
  reason      TEXT    DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
  decided_by  TEXT    DEFAULT '',
  decided_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
