CREATE TABLE observations (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  child_name   TEXT    DEFAULT '',
  obs_date     DATE    NOT NULL DEFAULT CURRENT_DATE,
  areas        TEXT[]  NOT NULL DEFAULT '{}',
  text         TEXT    NOT NULL,
  photo_url    TEXT    DEFAULT '',
  is_shared    BOOLEAN NOT NULL DEFAULT FALSE,
  practitioner TEXT    DEFAULT '',
  score        INTEGER CHECK(score BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assessments (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  area         TEXT    NOT NULL,
  score        INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  notes        TEXT    DEFAULT '',
  practitioner TEXT    DEFAULT '',
  assessed_at  DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reflections (
  id                    SERIAL PRIMARY KEY,
  nursery_id            INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id              INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date                  DATE    NOT NULL DEFAULT CURRENT_DATE,
  what_went_well        TEXT    DEFAULT '',
  areas_for_development TEXT    DEFAULT '',
  next_steps            TEXT    DEFAULT '',
  practitioner          TEXT    DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE planning (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  day         TEXT    DEFAULT 'Mon',
  time        TIME,
  category    TEXT    NOT NULL DEFAULT 'Other',
  room        TEXT    NOT NULL DEFAULT 'All',
  description TEXT    DEFAULT '',
  date        DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE send_flags (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  category     TEXT    NOT NULL,
  details      TEXT    DEFAULT '',
  support_plan TEXT    DEFAULT '',
  review_date  DATE,
  flagged_by   TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
