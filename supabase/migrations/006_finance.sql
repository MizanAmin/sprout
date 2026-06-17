CREATE TABLE invoices (
  id               SERIAL PRIMARY KEY,
  nursery_id       INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id         INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name       TEXT    DEFAULT '',
  invoice_ref      TEXT    DEFAULT '',
  period           TEXT    DEFAULT '',
  amount           NUMERIC NOT NULL DEFAULT 0,
  amount_paid      NUMERIC NOT NULL DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'Pending'
                           CHECK(status IN ('Pending','Paid','Overdue','Cancelled')),
  due_date         DATE,
  -- line_items shape: Array<{ description: string, hours?: number, rate?: number, amount: number }>
  -- Example: [{ "description": "2026-06 sessions", "hours": 40, "rate": 5.50, "amount": 220.00 },
  --           { "description": "Registration fee", "amount": 50.00 }]
  -- amount is always required; hours and rate are optional (for session-based lines only)
  -- The invoice total = line_items.reduce((sum, l) => sum + l.amount, 0)
  line_items       JSONB   NOT NULL DEFAULT '[]',
  notes            TEXT    DEFAULT '',
  sent_at          TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  reminder_count   INTEGER NOT NULL DEFAULT 0,
  gocardless_payment_id TEXT DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  invoice_id  INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  child_id    INTEGER REFERENCES children(id) ON DELETE SET NULL,
  amount      NUMERIC NOT NULL,
  method      TEXT    NOT NULL DEFAULT 'manual',
  reference   TEXT    DEFAULT '',
  notes       TEXT    DEFAULT '',
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_mandates (
  id               SERIAL PRIMARY KEY,
  nursery_id       INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id         INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name       TEXT    DEFAULT '',
  mandate_id       TEXT    DEFAULT '',
  redirect_flow_id TEXT    DEFAULT '',   -- GoCardless redirect flow ID (stored on create)
  session_token    TEXT    DEFAULT '',   -- GoCardless session token (must match on complete)
  status           TEXT    NOT NULL DEFAULT 'pending',
  parent_email     TEXT    DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_jobs (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period      TEXT    DEFAULT '',
  count       INTEGER NOT NULL DEFAULT 0,
  total       NUMERIC NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'success',
  error       TEXT    DEFAULT ''
);

CREATE TABLE reminder_log (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  invoice_id  INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  to_email    TEXT    DEFAULT '',
  result      TEXT    DEFAULT ''
);

CREATE TABLE funding_periods (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  start_date  DATE    NOT NULL,
  end_date    DATE    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE funding_claims (
  id                SERIAL PRIMARY KEY,
  nursery_id        INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  funding_period_id INTEGER REFERENCES funding_periods(id) ON DELETE CASCADE,
  child_id          INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name        TEXT    DEFAULT '',
  claimed_hours     NUMERIC NOT NULL DEFAULT 0,
  expected_hours    NUMERIC NOT NULL DEFAULT 0,
  status            TEXT    NOT NULL DEFAULT 'draft',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
