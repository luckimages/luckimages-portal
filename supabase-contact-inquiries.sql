-- Website contact form submissions (luckimages.com/contact), shown in the
-- Command Center's "Website Inquiries" box on the Updates page.
-- Run once in the Supabase SQL Editor. Safe to run more than once.
--
-- Before this, /api/contact only emailed Ryan (cc Leif) — nothing landed
-- in Nocturne, so an inquiry that got missed or junked was just gone.

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text not null,
  phone text,
  address text,
  listing_type text,
  services text[] not null default '{}',
  deliver_by date,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists contact_inquiries_created_at_idx
  on public.contact_inquiries (created_at desc);

-- RLS on with no policies = the public anon key can't read or write this
-- table at all. Only server routes using the service-role key (which
-- bypasses RLS) touch it: /api/contact inserts, /api/admin/inquiries reads.
alter table public.contact_inquiries enable row level security;

notify pgrst, 'reload schema';
