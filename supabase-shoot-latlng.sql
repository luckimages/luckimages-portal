-- Confirmed-location pin for shoots.
--
-- When a realtor books a shoot they drop a pin on a map to confirm exactly
-- which property we're shooting. These columns persist that pin so admin,
-- photographers, and realtors can all pull it up later (the "Map" button next
-- to the address on every shoot card / detail view).
--
-- Application code degrades gracefully when these are absent, so running this
-- is safe at any time and only needs to happen once per environment.

ALTER TABLE shoots ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE shoots ADD COLUMN IF NOT EXISTS lng double precision;
