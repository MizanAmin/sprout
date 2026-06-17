CREATE TABLE consent_templates (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  version     TEXT    NOT NULL DEFAULT '1.0',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consent_forms (
  id             SERIAL PRIMARY KEY,
  nursery_id     INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  template_id    INTEGER REFERENCES consent_templates(id) ON DELETE SET NULL,
  child_id       INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name     TEXT    DEFAULT '',
  signed_by      TEXT    DEFAULT '',
  signed_at      TIMESTAMPTZ,
  signature_data TEXT    DEFAULT '',
  status         TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','signed','declined')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE child_documents (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  file_url     TEXT    NOT NULL,
  file_type    TEXT    DEFAULT '',
  uploaded_by  TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
