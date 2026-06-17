-- 019_gocardless_settings.sql
-- Per-nursery GoCardless access token, surfaced via Settings.
-- The column already exists from 001_nurseries_auth.sql; this is an idempotent
-- safeguard so the settings endpoints can rely on it being present.
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS gocardless_access_token TEXT DEFAULT '';
