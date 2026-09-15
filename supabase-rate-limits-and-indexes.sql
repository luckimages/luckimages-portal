-- Backs src/lib/rateLimit.ts — throttles public forms (contact, quote,
-- password reset) against scripted abuse. Only ever touched by the
-- service-role client server-side, so RLS is enabled with no policies
-- (default-deny for anon/authenticated — same lesson as the pre-launch
-- security fixes: never leave a table reachable by the public anon key
-- with nothing restricting it).
create table if not exists public.rate_limit_hits (
  id bigserial primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_bucket_created_idx on public.rate_limit_hits (bucket, created_at);

alter table public.rate_limit_hits enable row level security;

-- Performance: shoots has no indexes beyond its primary key despite nearly
-- every dashboard/cron route filtering or sorting on these columns
-- (admin/shoots, admin/calendar, cron/recompute-mileage, cron/advance-status,
-- the client/photographer portals). Fine at today's volume, will degrade to
-- sequential scans as the shoot count grows.
create index if not exists shoots_scheduled_at_idx on public.shoots (scheduled_at);
create index if not exists shoots_status_idx on public.shoots (status);
create index if not exists shoots_contact_id_idx on public.shoots (contact_id);
create index if not exists shoots_client_id_idx on public.shoots (client_id);
create index if not exists shoots_photographer_ids_idx on public.shoots using gin (photographer_ids);

-- admin/website-analytics filters/sorts page_views by created_at on every
-- dashboard load; only link_click_id was indexed before.
create index if not exists page_views_created_at_idx on public.page_views (created_at);
