-- Feature-parity columns to match the live app (app.sproutnursery.co.uk).
-- All additive + idempotent; existing grants/RLS cover new columns.

ALTER TABLE observations      ADD COLUMN IF NOT EXISTS next_steps TEXT DEFAULT '';
ALTER TABLE assessments       ADD COLUMN IF NOT EXISTS term TEXT DEFAULT '';
ALTER TABLE calendar_events   ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'event';
ALTER TABLE send_flags        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE consent_forms     ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';
ALTER TABLE accident_book     ADD COLUMN IF NOT EXISTS riddor_reportable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE accident_book     ADD COLUMN IF NOT EXISTS parent_notified_how TEXT DEFAULT '';
ALTER TABLE incidents         ADD COLUMN IF NOT EXISTS body_part TEXT DEFAULT '';
ALTER TABLE incidents         ADD COLUMN IF NOT EXISTS riddor_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE funding_claims    ADD COLUMN IF NOT EXISTS claim_type TEXT DEFAULT 'LA';
ALTER TABLE funding_claims    ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE funding_claims    ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT '';
ALTER TABLE funding_claims    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE funding_claims    ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);
ALTER TABLE staff_training    ADD COLUMN IF NOT EXISTS hours NUMERIC(5,1);
ALTER TABLE staff_training    ADD COLUMN IF NOT EXISTS training_type TEXT DEFAULT '';
ALTER TABLE staff_training    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE staff_appraisals  ADD COLUMN IF NOT EXISTS period TEXT DEFAULT '';
ALTER TABLE staff_appraisals  ADD COLUMN IF NOT EXISTS overall_rating TEXT DEFAULT '';
ALTER TABLE rota              ADD COLUMN IF NOT EXISTS sat TEXT DEFAULT '';
ALTER TABLE rota              ADD COLUMN IF NOT EXISTS sun TEXT DEFAULT '';
ALTER TABLE relatives         ADD COLUMN IF NOT EXISTS has_portal_access BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE gdpr_settings     ADD COLUMN IF NOT EXISTS ico_registered BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE gdpr_settings     ADD COLUMN IF NOT EXISTS ico_number TEXT DEFAULT '';
ALTER TABLE gdpr_settings     ADD COLUMN IF NOT EXISTS privacy_notice TEXT DEFAULT '';
