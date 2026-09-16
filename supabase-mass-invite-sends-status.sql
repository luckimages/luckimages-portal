-- Mass Invite send failures were previously silent: a failed send only ever
-- flipped ephemeral React state ("Failed" in the picker), never persisted
-- anywhere, so a page refresh (or just checking back later) lost all record
-- of who didn't actually get an email. This records every attempt, success
-- or failure, so the Results table can show "ERROR" for anyone who didn't
-- get sent to.
alter table public.mass_invite_sends
  add column if not exists status text not null default 'sent',
  add column if not exists error_message text;

alter table public.mass_invite_sends
  drop constraint if exists mass_invite_sends_status_check;
alter table public.mass_invite_sends
  add constraint mass_invite_sends_status_check check (status in ('sent', 'error'));
