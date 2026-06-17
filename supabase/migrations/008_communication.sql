CREATE TABLE messages (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id    INTEGER REFERENCES children(id) ON DELETE SET NULL,
  from_role   TEXT    NOT NULL CHECK(from_role IN ('staff','parent')),
  from_name   TEXT    DEFAULT '',
  body        TEXT    NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expo push tokens (APNs + FCM handled by Expo's push service)
-- NOT web-push — no endpoint/p256dh/auth_key needed
CREATE TABLE push_subscriptions (
  id               SERIAL PRIMARY KEY,
  nursery_id       INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id          UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token  TEXT    NOT NULL UNIQUE,  -- e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  platform         TEXT    NOT NULL CHECK(platform IN ('ios','android')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_log (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT    DEFAULT '',
  title       TEXT    DEFAULT '',
  body        TEXT    DEFAULT '',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result      TEXT    DEFAULT ''
);
