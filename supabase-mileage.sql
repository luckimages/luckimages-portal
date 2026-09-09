-- Photographer mileage tracking — for tax deduction records and per-shoot
-- gas-cost job costing.
--
-- Model: for each photographer, each day they have shoots, we route
--   home -> shoot 1 -> shoot 2 -> ... -> home
-- as one drive (OpenRouteService, falling back to straight-line x1.3), store
-- the day's total in mileage_days, then split the miles + gas cost evenly
-- across that day's shoots into shoot_mileage (one row per shoot per
-- photographer).

-- ── Photographer profile: home base + vehicle ────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_address text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_lat double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_lng double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS car_year integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS car_make text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS car_model text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS car_mpg numeric;

-- ── One row per photographer per day they drove ──────────────────────────────
CREATE TABLE IF NOT EXISTS mileage_days (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id   uuid NOT NULL,
  day               date NOT NULL,
  origin_address    text,
  origin_lat        double precision,
  origin_lng        double precision,
  shoot_ids         uuid[] NOT NULL DEFAULT '{}',
  estimated_miles   numeric,                -- computed route distance
  actual_miles      numeric,                -- photographer override, if confirmed
  effective_miles   numeric,                -- actual_miles ?? estimated_miles (what the math uses)
  route_source      text,                   -- 'openrouteservice' | 'google' | 'haversine'
  legs              jsonb,                  -- [{from,to,miles}] for transparency
  gas_price_cents   integer,                -- $/gal snapshot at compute time
  mpg               numeric,                -- car MPG snapshot
  irs_rate_cents    integer,                -- $/mile snapshot
  gas_cost_cents    integer,
  deduction_cents   integer,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at      timestamptz,
  confirmed_by      text
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mileage_days_photog_day
  ON mileage_days (photographer_id, day);

-- ── The day's miles/cost split across each of that day's shoots ───────────────
CREATE TABLE IF NOT EXISTS shoot_mileage (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_id              uuid NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
  photographer_id       uuid NOT NULL,
  mileage_day_id        uuid REFERENCES mileage_days(id) ON DELETE SET NULL,
  day                   date NOT NULL,
  allocated_miles       numeric NOT NULL DEFAULT 0,
  allocated_gas_cents   integer NOT NULL DEFAULT 0,
  allocated_deduction_cents integer NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shoot_mileage_shoot_photog
  ON shoot_mileage (shoot_id, photographer_id);

-- Reads/writes go through service-role API routes (which run their own auth
-- checks); no direct anon/authenticated access to these tables.
ALTER TABLE mileage_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoot_mileage ENABLE ROW LEVEL SECURITY;

-- Config: current gas price and the IRS standard mileage rate. Admin-editable.
INSERT INTO admin_settings (key, value) VALUES
  ('gas_price_per_gallon', '2.75'),
  ('irs_mileage_rate',     '0.70')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
