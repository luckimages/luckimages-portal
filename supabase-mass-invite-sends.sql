-- Tracks each individual "Mass Portal Invite" send (src/app/admin/invite-all)
-- as its own row, tagged with a shared batch_id per click of "Send", so the
-- Results section on /admin/invite-all can show a per-blast funnel (sent ->
-- clicked -> registered) distinct from Outreach's lifetime "Portal Invite"
-- category rollup (dashboard/outreach, which still gets its own email_log
-- row per send from /api/admin/send-email, unaffected by this table).
--
-- One row per contact who was ACTUALLY sent an email -- inserted only after
-- /api/admin/send-email returns ok, never pre-created for the whole
-- selection up front, so a page refresh mid-send can't fabricate "sent"
-- rows for contacts whose email never went out.
--
-- Resending a contact who hasn't clicked yet is a new Send click => a new
-- batch_id => a second row for that contact. A click is attributed to
-- whichever batch's [sent_at, next resend's sent_at) window it falls in
-- (query-time logic in invite-all/page.tsx), since the tracked link itself
-- is identical across resends (it encodes contact_id, not batch_id).
--
-- IMPORTANT: run supabase-fix-admin-profiles.sql first (if you haven't
-- already) -- this table's RLS policy depends on public.is_admin(), which
-- returns false for both Ryan and Leif until that file backfills their
-- profiles rows. Both files are idempotent, safe to re-run.

create table if not exists public.mass_invite_sends (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  sent_by text not null,
  sent_at timestamptz not null default now(),
  unique (batch_id, contact_id)
);

create index if not exists mass_invite_sends_contact_id_idx on public.mass_invite_sends(contact_id);
create index if not exists mass_invite_sends_sent_at_idx on public.mass_invite_sends(sent_at desc);

alter table public.mass_invite_sends enable row level security;

drop policy if exists "Admin full access" on public.mass_invite_sends;
create policy "Admin full access" on public.mass_invite_sends for all using (public.is_admin());

notify pgrst, 'reload schema';
