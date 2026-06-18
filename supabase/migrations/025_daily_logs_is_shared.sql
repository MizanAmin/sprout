-- Per-log "share with parent" flag for daily logs. Defaults TRUE so existing
-- logs and the prior always-shared behaviour are preserved; staff can now untick
-- a log to keep it internal. The parent endpoints filter on is_shared = true.
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT TRUE;
