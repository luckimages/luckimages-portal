-- ============================================================
-- Security fix: stop anyone from making themselves an admin.
-- Run this whole file once in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → Run). Safe to run more
-- than once (idempotent).
-- ============================================================
--
-- The hole: public.is_admin() (which gates "Admin full access" on
-- contacts, shoots, invoices, media, pay_stubs, photographer_invites,
-- profiles) trusts profiles.role = 'admin'. Two ways a stranger could
-- set that on their own account using only the public anon key that
-- ships in every page's JS bundle:
--
--   1. Sign up with user metadata { role: "admin" } —
--      handle_new_user() copied raw_user_meta_data->>'role' straight
--      into profiles.role. Public signups are enabled and email
--      confirmation is off, so this needs no real inbox.
--   2. Any logged-in realtor/photographer PATCHes their own profiles
--      row to role = 'admin' — the "Own profile" policy was
--      FOR ALL USING (auth.uid() = id) with no column restriction
--      (it also allowed delete + re-insert with a new role).
--
-- Either one gives full read/write on every CRM + financial table via
-- the Supabase REST API. (The /dashboard and /api/admin app routes were
-- never exposed — those check ADMIN_EMAILS — but the database was.)

-- 1) Signup can only ever produce 'realtor' or 'photographer'. Those are
--    the only two roles the app's signup forms send (register/page.tsx,
--    photographer-register/page.tsx); anything else falls back to
--    'realtor'. Admin is never grantable from the client.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    case
      when new.raw_user_meta_data->>'role' = 'photographer' then 'photographer'
      else 'realtor'
    end
  );
  return new;
end;
$$;

-- 2) Rebuild profiles policies from scratch (drops any extra permissive
--    policy that may have been added in the dashboard, since policies
--    are OR'ed and any one of them would reopen the hole). Users can
--    read and update their own row only — no self insert/delete. The
--    app never writes profiles from the browser (the only write,
--    /api/portal/photographer-profile, uses the service-role key).
alter table public.profiles enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end $$;

create policy "Admin full access" on public.profiles for all using (public.is_admin());
create policy "Read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- 3) Even on their own row, end users can't change role. Checked in a
--    trigger because RLS can't restrict individual columns. Only applies
--    to requests made as anon/authenticated (the public key + a user's
--    login) — the service-role key, the SQL Editor, and existing admins
--    are unaffected. Deliberately NOT security definer, so current_user
--    is the real caller's role.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated')
     and not public.is_admin() then
    raise exception 'Only an admin can change a profile role';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- 4) Clean-up: if anyone already used the hole, demote them. Ryan and
--    Leif are the only real admins (same ids as
--    supabase-fix-admin-profiles.sql). As of 2026-09-17 nobody else had
--    admin, so this should update 0 rows.
update public.profiles
set role = 'realtor'
where role = 'admin'
  and id not in (
    '81d6e793-ff8d-4bf1-87c2-480d9eef61d8', -- Ryan Luck
    'dc9ee0b0-878b-4f77-8e2d-38faf466ff45'  -- Leif Tilton
  );

notify pgrst, 'reload schema';

-- 5) Verify — the result grid should show exactly 3 policies
--    (Admin full access / Read own profile / Update own profile) and
--    exactly 2 admins (Ryan Luck, Leif Tilton).
select 'policy' as kind, policyname as name, cmd as detail
from pg_policies where schemaname = 'public' and tablename = 'profiles'
union all
select 'admin', full_name, id::text
from public.profiles where role = 'admin';
