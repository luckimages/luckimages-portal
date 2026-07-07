-- Stores the estimated drive time (minutes, from home base) computed when a
-- realtor submits a booking request, so the review card can show it without
-- re-calling the Maps API.

alter table public.shoots add column if not exists drive_minutes integer;
alter table public.shoots add column if not exists confirmed_at timestamptz;

notify pgrst, 'reload schema';
