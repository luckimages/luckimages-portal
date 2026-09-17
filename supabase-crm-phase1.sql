-- ============================================================
-- CRM Phase 1: follow-ups, web leads → contacts, unsubscribe /
-- do-not-contact. Run this whole file once in the Supabase SQL Editor
-- AFTER supabase-contact-inquiries.sql, and BEFORE deploying the code.
-- Safe to run more than once (idempotent).
-- ============================================================

-- 1) Follow-ups are todos linked to a contact. A contact has at most one
--    open follow-up (todos.completed_at is null). They show on the contact
--    page, the Contacts list, Updates → Follow-ups Due, and Todos.
alter table public.todos
  add column if not exists contact_id uuid references public.contacts(id) on delete cascade;

create index if not exists todos_contact_open_idx
  on public.todos (contact_id) where completed_at is null;

-- 2) Website leads (contact form + quote requests) link to the contact
--    they created or matched.
alter table public.contact_inquiries
  add column if not exists kind text not null default 'contact',   -- 'contact' | 'quote'
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists square_footage text,
  add column if not exists quote_total numeric;

create index if not exists contact_inquiries_contact_idx
  on public.contact_inquiries (contact_id);

-- 3) Unsubscribe + do-not-contact.
--    email_unsubscribed_at — set when they click Unsubscribe in a marketing
--      email; marketing sends (Outreach, Quick Send, Mass Invite) skip them.
--      Booking/delivery/invoice emails still go out.
--    do_not_contact — set by Ryan/Leif when someone asks not to be contacted
--      at all; blocks marketing email and is flagged on Contacts/Cold Calls.
--    unsubscribe_token — the per-contact secret in the unsubscribe link (so
--      the link doesn't expose the contact's id). Existing rows each get their
--      own random token when this runs.
alter table public.contacts
  add column if not exists email_unsubscribed_at timestamptz,
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists contacts_unsubscribe_token_idx
  on public.contacts (unsubscribe_token);

-- 4) One-time: move Cold Calls' follow-ups that are currently due (or
--    coming up) into the new system. Mirrors the Cold Calls page's own rule
--    (cold-calls/page.tsx nextFollowUpDate/isFollowUpDue): the contact's most
--    recent call; its explicit call-back date if set, otherwise +1 day
--    (interested / voicemail / default), +7 (send_info), +45 (nurture), none
--    for dead/closed; skipped if more than 14 days past due. Marked
--    created_by = 'cold-calls-import' so re-running never duplicates.
insert into public.todos (text, title, notes, list_id, assigned_to, due_date, created_by, is_urgent, contact_id)
select
  'Follow up: ' || c.name,
  'Follow up: ' || c.name,
  'Cold call follow-up' || coalesce(E'\n' || lc.notes, ''),
  (select id from public.todo_lists where name = 'General' limit 1),
  case when lower(lc.called_by) in ('ryan', 'leif') then lower(lc.called_by) else 'both' end,
  due.d,
  'cold-calls-import',
  false,
  c.id
from (
  select distinct on (contact_id) contact_id, outcome, called_at, follow_up_date, called_by, notes
  from public.cold_calls
  where contact_id is not null
  order by contact_id, called_at desc
) lc
join public.contacts c on c.id = lc.contact_id
cross join lateral (
  select coalesce(
    lc.follow_up_date::date,
    case
      when coalesce(lc.outcome, '') ~ '(^|,)(dead|closed)(,|$)' then null
      when coalesce(lc.outcome, '') ~ '(^|,)nurture(,|$)' then (lc.called_at at time zone 'America/Chicago')::date + 45
      when coalesce(lc.outcome, '') ~ '(^|,)send_info(,|$)' then (lc.called_at at time zone 'America/Chicago')::date + 7
      else (lc.called_at at time zone 'America/Chicago')::date + 1
    end
  ) as d
) due
where due.d is not null
  and due.d >= (now() at time zone 'America/Chicago')::date - 14
  and coalesce(c.stage, '') not in ('deleted', 'dead')
  and not exists (select 1 from public.todos t where t.contact_id = c.id and t.completed_at is null)
  and not exists (select 1 from public.todos t where t.contact_id = c.id and t.created_by = 'cold-calls-import');

notify pgrst, 'reload schema';

-- Verify: how many follow-ups came over from Cold Calls, and that every
-- contact got an unsubscribe token.
select
  (select count(*) from public.todos where created_by = 'cold-calls-import') as follow_ups_imported,
  (select count(*) from public.contacts where unsubscribe_token is null) as contacts_missing_token;
