-- Twilio phone system: shared call/text line for Ryan + Leif.
-- Creates the tables backing the new /dashboard/phone app (Calls, Messages,
-- Voicemail tabs). Run this once in the Supabase SQL editor. The app degrades
-- gracefully if this hasn't been run yet (Phone tab shows a setup notice),
-- but nothing here requires a live Twilio subscription to exist safely.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text,
  to_number text,
  body text,
  status text, -- queued | sent | delivered | failed | received
  twilio_sid text,
  sent_by text, -- 'ryan' | 'leif' — null for inbound
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_contact_id_idx on public.messages(contact_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text,
  to_number text,
  status text, -- completed | missed | no-answer | busy | failed | voicemail
  duration_seconds integer,
  recording_url text,
  is_voicemail boolean not null default false,
  answered_by text, -- 'ryan' | 'leif' — null if missed/voicemail
  twilio_sid text,
  created_at timestamptz not null default now()
);
create index if not exists calls_contact_id_idx on public.calls(contact_id);
create index if not exists calls_created_at_idx on public.calls(created_at desc);

-- Writes come from Twilio webhooks and app actions via the service-role key
-- (bypasses RLS); only the admin dashboard (page-level auth guard) ever
-- reads these client-side, same pattern as link_clicks.
alter table public.messages enable row level security;
alter table public.calls enable row level security;

drop policy if exists "Authenticated can read messages" on public.messages;
create policy "Authenticated can read messages"
  on public.messages for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated can read calls" on public.calls;
create policy "Authenticated can read calls"
  on public.calls for select
  using (auth.role() = 'authenticated');

-- Tracks whether the automated post-delivery review-request text has
-- already gone out for a shoot, so the daily cron doesn't re-send it.
alter table public.shoots add column if not exists review_text_sent_at timestamptz;

-- Force PostgREST to pick up the new tables/columns right away.
notify pgrst, 'reload schema';
