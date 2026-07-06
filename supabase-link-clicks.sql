-- Creates the link_clicks table used by /api/track-link to record which
-- pitch-email links each lead clicks. Referenced by the Email Outreach
-- Engagement page and the cold-call Lead History.

create table if not exists public.link_clicks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  service text not null,
  clicked_at timestamptz not null default now()
);

create index if not exists link_clicks_contact_id_idx on public.link_clicks(contact_id);
create index if not exists link_clicks_clicked_at_idx  on public.link_clicks(clicked_at desc);

-- Writes come from the service-role key (track-link route) and bypass RLS.
-- Logged-in dashboard users can read.
alter table public.link_clicks enable row level security;

drop policy if exists "Authenticated can read link_clicks" on public.link_clicks;
create policy "Authenticated can read link_clicks"
  on public.link_clicks for select
  using (auth.role() = 'authenticated');

-- Force PostgREST to pick up the new table right away.
notify pgrst, 'reload schema';
