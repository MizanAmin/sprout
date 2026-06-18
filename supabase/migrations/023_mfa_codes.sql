-- Email second-factor codes for staff/manager logins (one active code per user).
-- Written/read only by the API's privileged pool connection (which bypasses RLS).
-- RLS is ENABLED with NO policy and grants are revoked from the PostgREST roles,
-- so anon/authenticated clients can never read the code hashes. We deliberately
-- do NOT FORCE row security, so the table owner (the API connection) still works.
CREATE TABLE IF NOT EXISTS mfa_codes (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mfa_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mfa_codes FROM anon, authenticated, app_user;
