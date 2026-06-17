CREATE TABLE nurseries (
  id                      SERIAL PRIMARY KEY,
  name                    TEXT    NOT NULL,
  address                 TEXT    DEFAULT '',
  phone                   TEXT    DEFAULT '',
  email                   TEXT    DEFAULT '',
  ofsted_no               TEXT    DEFAULT '',
  logo_url                TEXT    DEFAULT '',
  plan                    TEXT    NOT NULL DEFAULT 'seedling'
                                  CHECK(plan IN ('seedling','blossom','grove','forest','cancelled')),
  billing_cycle           TEXT    NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','annual')),
  plan_started_at         TIMESTAMPTZ,
  trial_ends_at           TIMESTAMPTZ,
  stripe_customer_id      TEXT    DEFAULT '',
  stripe_subscription_id  TEXT    DEFAULT '',
  trial_warning_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  conversion_emails_sent  JSONB   NOT NULL DEFAULT '[]',
  status                  TEXT    NOT NULL DEFAULT 'active',
  admin_notes             TEXT    DEFAULT '',
  -- fee rates per age band
  fee_rate                NUMERIC NOT NULL DEFAULT 5.50,
  fee_rate_under2         NUMERIC NOT NULL DEFAULT 7.00,
  fee_rate_2yo            NUMERIC NOT NULL DEFAULT 5.50,
  fee_rate_3to4           NUMERIC NOT NULL DEFAULT 4.50,
  funding_rate_under2     NUMERIC NOT NULL DEFAULT 0,
  funding_rate_2yo        NUMERIC NOT NULL DEFAULT 0,
  funding_rate_3to4       NUMERIC NOT NULL DEFAULT 0,
  -- auto invoice
  auto_invoice_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  auto_invoice_day        INTEGER NOT NULL DEFAULT 1,
  auto_invoice_last_run   DATE,
  -- email / reminder
  smtp_host               TEXT NOT NULL DEFAULT '',
  smtp_port               INTEGER NOT NULL DEFAULT 587,
  smtp_user               TEXT NOT NULL DEFAULT '',
  smtp_pass               TEXT NOT NULL DEFAULT '',
  smtp_from               TEXT NOT NULL DEFAULT '',
  reminder_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_days_overdue   INTEGER NOT NULL DEFAULT 3,
  reminder_interval_days  INTEGER NOT NULL DEFAULT 7,
  -- gocardless
  gocardless_access_token TEXT NOT NULL DEFAULT '',
  -- created
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mirror of auth.users for app profile data
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'staff'
                      CHECK(role IN ('manager','staff','parent')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No child_id here: one parent can have multiple children (siblings).
  -- Use user_children junction table below.
);

-- NOTE: user_children depends on children(id), which is created in
-- migration 002. It is defined there, after the children table exists.

-- RLS: each user sees only rows in their own nursery
-- (public.current_nursery_id() — defined in 000_auth_helpers — resolves the
--  tenant from the API GUC or the JWT, so this works on both access paths.)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant ON users
  USING (nursery_id = public.current_nursery_id());
