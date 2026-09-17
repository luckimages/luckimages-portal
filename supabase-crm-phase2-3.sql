-- ============================================================
-- CRM Phases 2 + 3: sequences, email reply logging, client retention,
-- tags, saved contact views. Run this whole file once in the Supabase SQL
-- Editor AFTER supabase-crm-phase1.sql and BEFORE deploying the code.
-- Safe to run more than once (idempotent).
-- ============================================================

-- ── Phase 2: Sequences ──────────────────────────────────────────────────────
-- A sequence is an ordered list of steps, each on a day offset from the day a
-- contact is enrolled: email steps send automatically (through the same
-- unsubscribe-aware path as Outreach); call and text steps become follow-ups
-- for Ryan/Leif to do by hand. Steps live in one jsonb column:
--   [{ "day": 0, "kind": "email", "subject": "...", "body": "..." },
--    { "day": 3, "kind": "text",  "note": "..." },
--    { "day": 6, "kind": "call",  "note": "..." }]
create table if not exists public.sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  steps jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per contact per run through a sequence. A contact can only be in
-- one active sequence at a time. It stops on its own when they reply, book a
-- shoot, unsubscribe, or get marked Do Not Contact / dead.
create table if not exists public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'active',
  next_step integer not null default 0,
  next_run_on date,
  started_on date not null,
  stopped_reason text,
  enrolled_by text,
  last_step_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sequence_enrollments drop constraint if exists sequence_enrollments_status_check;
alter table public.sequence_enrollments add constraint sequence_enrollments_status_check check (status in ('active', 'completed', 'stopped'));

create unique index if not exists sequence_enrollments_one_active_idx
  on public.sequence_enrollments (contact_id) where status = 'active';
create index if not exists sequence_enrollments_due_idx
  on public.sequence_enrollments (next_run_on) where status = 'active';

-- ── Phase 2: Email reply logging ────────────────────────────────────────────
-- Replies to outreach/sequence emails, received through Resend Inbound
-- (/api/webhooks/resend-inbound), logged on the contact's timeline and
-- forwarded to Ryan/Leif's inbox.
create table if not exists public.email_replies (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text not null unique,
  contact_id uuid references public.contacts(id) on delete set null,
  forwarded_to text,
  from_email text,
  from_name text,
  subject text,
  body_text text,
  received_at timestamptz not null default now()
);
create index if not exists email_replies_contact_idx on public.email_replies (contact_id, received_at desc);

-- ── Phase 2: Client retention ───────────────────────────────────────────────
-- Automatic follow-ups (post-delivery check-ins, dormant-client nudges,
-- sequence call/text steps) carry a key so the daily jobs never create the
-- same one twice. Hand-made todos leave it null.
alter table public.todos add column if not exists auto_key text;
create unique index if not exists todos_auto_key_idx on public.todos (auto_key) where auto_key is not null;

-- ── Phase 3: Tags + saved views ─────────────────────────────────────────────
alter table public.contacts add column if not exists tags text[] not null default '{}';
create index if not exists contacts_tags_idx on public.contacts using gin (tags);

create table if not exists public.saved_contact_views (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

-- All of the above is only ever read/written server-side with the
-- service-role key (which bypasses RLS). RLS on with no policies keeps the
-- public anon key out.
alter table public.sequences enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.email_replies enable row level security;
alter table public.saved_contact_views enable row level security;

notify pgrst, 'reload schema';

select
  (select count(*) from information_schema.tables where table_schema = 'public'
     and table_name in ('sequences', 'sequence_enrollments', 'email_replies', 'saved_contact_views')) as new_tables_present_of_4,
  (select count(*) from information_schema.columns where table_schema = 'public'
     and ((table_name = 'contacts' and column_name = 'tags') or (table_name = 'todos' and column_name = 'auto_key'))) as new_columns_present_of_2;
