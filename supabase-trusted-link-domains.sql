-- Backs the /api/track-link open-redirect fix (src/lib/trustedLinkDomains.ts).
-- Only ever written to from send-email (admin-authenticated — a Quick Send
-- actually going out) and only ever read from track-link (public). RLS
-- enabled with no policies: same default-deny pattern as rate_limit_hits —
-- reachable only via the service-role key server-side, never the public
-- anon key.
create table if not exists public.trusted_link_domains (
  domain text primary key,
  created_at timestamptz not null default now()
);

alter table public.trusted_link_domains enable row level security;
