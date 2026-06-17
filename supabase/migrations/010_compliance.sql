CREATE TABLE risk_assessments (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  location    TEXT    DEFAULT '',
  reviewed_by TEXT    DEFAULT '',
  review_date DATE,
  next_review DATE,
  status      TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE risk_assessment_items (
  id                  SERIAL PRIMARY KEY,
  nursery_id          INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  risk_assessment_id  INTEGER NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
  hazard              TEXT    NOT NULL,
  who_affected        TEXT    DEFAULT '',
  existing_controls   TEXT    DEFAULT '',
  likelihood          INTEGER NOT NULL DEFAULT 3 CHECK(likelihood BETWEEN 1 AND 5),
  severity            INTEGER NOT NULL DEFAULT 3 CHECK(severity BETWEEN 1 AND 5),
  additional_controls TEXT    DEFAULT '',
  responsible_person  TEXT    DEFAULT '',
  target_date         DATE
);

CREATE TABLE policies (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  category    TEXT    DEFAULT '',
  content     TEXT    DEFAULT '',
  version     TEXT    NOT NULL DEFAULT '1.0',
  reviewed_at DATE,
  next_review DATE,
  status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_signoffs (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  policy_id   INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  staff_name  TEXT    NOT NULL,
  signed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_training (
  id              SERIAL PRIMARY KEY,
  nursery_id      INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_id        INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  staff_name      TEXT    DEFAULT '',
  course_name     TEXT    NOT NULL,
  provider        TEXT    DEFAULT '',
  completed_date  DATE,
  expiry_date     DATE,
  certificate_url TEXT    DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'completed' CHECK(status IN ('planned','completed','expired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_appraisals (
  id             SERIAL PRIMARY KEY,
  nursery_id     INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_id       INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  staff_name     TEXT    DEFAULT '',
  date           DATE    NOT NULL DEFAULT CURRENT_DATE,
  appraiser      TEXT    DEFAULT '',
  strengths      TEXT    DEFAULT '',
  areas_for_dev  TEXT    DEFAULT '',
  targets        TEXT    DEFAULT '',
  next_review    DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE qualifications (
  id              SERIAL PRIMARY KEY,
  nursery_id      INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_id        INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  staff_name      TEXT    DEFAULT '',
  qualification   TEXT    NOT NULL,
  awarding_body   TEXT    DEFAULT '',
  date_achieved   DATE,
  expiry_date     DATE,
  level           TEXT    DEFAULT '',
  certificate_url TEXT    DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wellbeing_checkins (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_id    INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  staff_name  TEXT    DEFAULT '',
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  mood        INTEGER NOT NULL CHECK(mood BETWEEN 1 AND 5),
  workload    INTEGER NOT NULL CHECK(workload BETWEEN 1 AND 5),
  support     INTEGER NOT NULL CHECK(support BETWEEN 1 AND 5),
  notes       TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
