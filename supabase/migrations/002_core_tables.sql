CREATE TABLE children (
  id                SERIAL PRIMARY KEY,
  nursery_id        INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  dob               DATE,
  gender            TEXT    DEFAULT '',
  room              TEXT    DEFAULT '',
  status            TEXT    NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
  allergy           TEXT    DEFAULT 'None',
  medical_info      TEXT    DEFAULT '',
  emergency_contact TEXT    DEFAULT '',
  contact_phone     TEXT    DEFAULT '',
  notes             TEXT    DEFAULT '',
  photo_url         TEXT    DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE relatives (
  id                   SERIAL PRIMARY KEY,
  nursery_id           INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id             INTEGER REFERENCES children(id) ON DELETE SET NULL,
  name                 TEXT    NOT NULL,
  relation             TEXT    DEFAULT '',
  phone                TEXT    DEFAULT '',
  email                TEXT    DEFAULT '',
  address              TEXT    DEFAULT '',
  is_primary_contact   BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE rooms (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  capacity    INTEGER NOT NULL DEFAULT 10,
  age_group   TEXT    DEFAULT '',
  staff_lead  TEXT    DEFAULT '',
  color       TEXT    NOT NULL DEFAULT '#4f8ef7'
);

CREATE TABLE staff (
  id            SERIAL PRIMARY KEY,
  nursery_id    INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  role          TEXT    DEFAULT '',
  room          TEXT    DEFAULT '',
  qualification TEXT    DEFAULT '',
  phone         TEXT    DEFAULT '',
  start_date    DATE,
  status        TEXT    NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive'))
);

-- Many-to-many: one parent user → one or more children
-- Also supports: one child → multiple parent/guardian accounts
-- Defined here (not in 001) because it references children(id), created above.
CREATE TABLE user_children (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id    INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  UNIQUE(user_id, child_id)
);

-- RLS: parent can only see their own child links
ALTER TABLE user_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_children FORCE ROW LEVEL SECURITY;
CREATE POLICY user_children_tenant ON user_children
  USING (nursery_id = public.current_nursery_id());
