-- Tenant isolation — every query filters by nursery_id
CREATE INDEX IF NOT EXISTS idx_children_nursery          ON children(nursery_id);
CREATE INDEX IF NOT EXISTS idx_attendance_nursery_date   ON attendance(nursery_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_child_date     ON attendance(child_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_child_date     ON daily_logs(child_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_nursery_status   ON invoices(nursery_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_child            ON invoices(child_id);
CREATE INDEX IF NOT EXISTS idx_messages_nursery_child    ON messages(nursery_id, child_id);
CREATE INDEX IF NOT EXISTS idx_messages_created          ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_child_sessions_child      ON child_sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_child_sessions_nursery_day ON child_sessions(nursery_id, day);
CREATE INDEX IF NOT EXISTS idx_observations_child        ON observations(child_id, obs_date DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_child         ON assessments(child_id);
CREATE INDEX IF NOT EXISTS idx_push_token                ON push_subscriptions(expo_push_token);
CREATE INDEX IF NOT EXISTS idx_user_children_user        ON user_children(user_id);
CREATE INDEX IF NOT EXISTS idx_user_children_child       ON user_children(child_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_nursery         ON audit_log(nursery_id, created_at DESC);
