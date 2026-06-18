-- Self-owned parent-login OTP codes (one active code per email). Written/read
-- only by the API's privileged pool connection (which bypasses RLS). RLS is
-- ENABLED with NO policy and grants revoked from the PostgREST roles, so
-- anon/authenticated clients can never read the code hashes. Not FORCEd, so the
-- table owner (the API connection) still works.
CREATE TABLE IF NOT EXISTS login_codes (
  email      TEXT        PRIMARY KEY,
  code_hash  TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE login_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON login_codes FROM anon, authenticated, app_user;
