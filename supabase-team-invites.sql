-- Replaces the team-join link's security boundary. It used to be just the
-- team's own (permanent, never-expiring) id — anyone who ever got hold of
-- that exact URL (a forwarded email, a leaked link) could join the team,
-- indefinitely, regardless of who they actually are. Each invite now gets
-- its own single-use, 14-day, email-bound token instead.
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists team_invites_token_idx on public.team_invites (token);

-- Service-role only, same default-deny pattern as the other tables added
-- this week — never reachable via the public anon key.
alter table public.team_invites enable row level security;
