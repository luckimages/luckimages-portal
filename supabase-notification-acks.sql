-- Per-admin acknowledgment tracking for the new box-based Command Center.
-- Generic across source types (pending shoots, new registrations, and any
-- future box) so we don't need a new table per box type.
create table if not exists public.notification_acks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  acked_by text not null,
  acked_at timestamptz not null default now(),
  unique (source_type, source_id, acked_by)
);

create index if not exists notification_acks_lookup_idx
  on public.notification_acks(source_type, acked_by);

-- Timestamp of when a contact actually registered a portal account — needed
-- because contacts.created_at reflects when the CONTACT record was first
-- created (e.g. from a cold call), which can be long before they register.
alter table public.contacts add column if not exists registered_at timestamptz;

notify pgrst, 'reload schema';
