-- Expenses / P&L for the Revenue app.
--
-- Nocturne is the source of truth for the operating budget (Ryan uses
-- QuickBooks only for sending/receiving invoices, not accounting — yet).
--
-- Model:
--   • operating_expenses  — the manual month-to-month budget (software,
--     insurance, marketing, gear, vehicle, …). `recurring` rows auto-carry
--     into each new month.
--   • Stripe fees, gas, and editing cost are NOT stored here — they're
--     derived at request time from paid invoices, mileage_days, and the
--     per-shoot editing cost below, so they can never drift.
--
-- Net Profit = paid income − (operating budget + Stripe fees + gas + editing)

-- ── Per-shoot editing cost ──────────────────────────────────────────────────
-- Whoever delivers a shoot must record what they spent on editing before the
-- "Deliver to Client" button unlocks (enforced in /api/admin/deliver-shoot).
ALTER TABLE shoots ADD COLUMN IF NOT EXISTS editing_cost_cents integer;
ALTER TABLE shoots ADD COLUMN IF NOT EXISTS editing_cost_by text;
ALTER TABLE shoots ADD COLUMN IF NOT EXISTS editing_cost_at timestamptz;

-- ── Manual operating budget ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operating_expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incurred_on  date NOT NULL,                    -- the month it lands in (day is cosmetic)
  category     text NOT NULL DEFAULT 'other',    -- software | insurance | marketing | gear | vehicle | contractor | other
  label        text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  recurring    boolean NOT NULL DEFAULT false,   -- carries forward into future months
  note         text,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_month
  ON operating_expenses (incurred_on);

-- Billing cadence — informational label (amount_cents is always the effective
-- monthly figure; annual costs are stored amortized). 'monthly' | 'annual' | 'fluctuates'
ALTER TABLE operating_expenses ADD COLUMN IF NOT EXISTS cadence text NOT NULL DEFAULT 'monthly';

-- Set for line items whose amount is refreshed from a live bill each month.
-- 'twilio' | 'r2' | null
ALTER TABLE operating_expenses ADD COLUMN IF NOT EXISTS auto_source text;

-- When a recurring row is seeded into a later month we point it back at the
-- template so we never double-seed the same series into the same month.
ALTER TABLE operating_expenses ADD COLUMN IF NOT EXISTS recurring_source_id uuid REFERENCES operating_expenses(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_operating_expenses_recurring_month
  ON operating_expenses (recurring_source_id, incurred_on)
  WHERE recurring_source_id IS NOT NULL;

-- Reads/writes go through service-role admin API routes (own auth checks).
ALTER TABLE operating_expenses ENABLE ROW LEVEL SECURITY;

-- ── Config: Stripe processing fee ──────────────────────────────────────────
INSERT INTO admin_settings (key, value) VALUES
  ('stripe_fee_percent',    '2.9'),
  ('stripe_fee_flat_cents', '30')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
