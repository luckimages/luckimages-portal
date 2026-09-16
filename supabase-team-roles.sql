-- Adds a Lead/Member role to team_members for the new Team management tab.
-- Whoever created the team is backfilled as its lead; everyone else already
-- on a team becomes a regular member.
alter table public.team_members add column if not exists role text not null default 'member';
alter table public.team_members drop constraint if exists team_members_role_check;
alter table public.team_members add constraint team_members_role_check check (role in ('lead', 'member'));

update public.team_members tm
set role = 'lead'
from public.teams t
where t.id = tm.team_id and t.created_by = tm.contact_id;
