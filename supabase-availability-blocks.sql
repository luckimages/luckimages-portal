-- Availability blocking on the Master Calendar — Ryan and Leif mark the days
-- and times they can't shoot, so neither books the other into a conflict.

CREATE TABLE IF NOT EXISTS availability_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  user_name   text NOT NULL,           -- denormalized for display (e.g. "Ryan")
  all_day     boolean NOT NULL DEFAULT false,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_range ON availability_blocks (start_at, end_at);

-- Reads/writes go through /api/admin/availability (service-role + admin check).
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
