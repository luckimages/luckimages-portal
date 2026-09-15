-- ============================================================
-- Pre-launch security fixes — run this whole file once in the
-- Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Safe to run more than once (idempotent).
-- ============================================================

-- 1) Fix infinite-recursion in the "profiles" admin policy.
--    profiles' own "Admin full access" policy queries profiles to check
--    the caller's role, which re-triggers profiles' RLS on itself —
--    Postgres error 42P17 "infinite recursion detected in policy for
--    relation profiles". Confirmed live: querying profiles/invoices
--    with the anon key currently 500s with this exact error. A
--    SECURITY DEFINER function bypasses RLS for its own internal
--    lookup, which breaks the loop. Every other table's "Admin full
--    access" policy that queries profiles (shoots, invoices, media,
--    pay_stubs, photographer_invites) starts working correctly once
--    this is fixed — none of those need to change themselves.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

drop policy if exists "Admin full access" on public.profiles;
create policy "Admin full access" on public.profiles for all using (public.is_admin());

-- 2) Lock down "contacts" — verified live that this table currently has
--    NO effective RLS restriction: the public anon key (shipped in every
--    page's JS bundle) can read every row — 121 real leads/clients with
--    name, email, phone, brokerage, revenue, lead source. This drops
--    whatever policy/policies currently exist (regardless of name) and
--    replaces them with: users see/edit their own linked contact row,
--    admins see/edit everything. No app code inserts into contacts from
--    the browser (it's always done server-side with the service-role
--    key, which bypasses RLS), so no insert policy is needed here.
alter table public.contacts enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'contacts' loop
    execute format('drop policy %I on public.contacts', pol.policyname);
  end loop;
end $$;

create policy "Own contact record" on public.contacts for select using (user_id = auth.uid());
create policy "Update own contact record" on public.contacts for update using (user_id = auth.uid());
create policy "Admin full access" on public.contacts for all using (public.is_admin());

-- 3) Lock down "photographer_invites" — the existing "using (true)"
--    policies let anyone with the anon key list every pending invite
--    (name/email/token) or flip any invite's "used" flag, verified live
--    (HTTP 200 on an unauthenticated, unfiltered select). The app no
--    longer needs anon access here — invite validation and "mark used"
--    were moved to /api/auth/photographer-invite (deployed alongside
--    this migration), which uses the service-role key server-side.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'photographer_invites' loop
    execute format('drop policy %I on public.photographer_invites', pol.policyname);
  end loop;
end $$;

create policy "Admin full access" on public.photographer_invites for all using (public.is_admin());
