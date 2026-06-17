-- Add only the tables that need real-time subscriptions.
-- Do NOT add all tables — unnecessary replication overhead.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE booking_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE holiday_credit_requests;
