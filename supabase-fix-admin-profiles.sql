-- ============================================================
-- Fix: restore admin visibility after supabase-security-fixes.sql
-- Run this whole file once in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → Run). Safe to run more
-- than once (idempotent).
-- ============================================================

-- supabase-security-fixes.sql locked "contacts" (and every other
-- "Admin full access" policy) behind public.is_admin(), which checks
-- profiles.role = 'admin'. Ryan and Leif are the two owner accounts —
-- they never went through the invite/signup flow that creates a
-- profiles row (see handle_new_user() in supabase-setup.sql), so
-- neither of them has a profiles row at all. With no row, is_admin()
-- returns false, so the new RLS policy shows them zero contacts
-- (and would do the same on shoots, invoices, media, pay_stubs,
-- photographer_invites — anything else gated by is_admin()).
-- Both accounts already carry role: "admin" in their auth.users
-- metadata; this just mirrors that into the profiles table so
-- is_admin() sees it.

insert into public.profiles (id, full_name, role)
values
  ('81d6e793-ff8d-4bf1-87c2-480d9eef61d8', 'Ryan Luck', 'admin'),
  ('dc9ee0b0-878b-4f77-8e2d-38faf466ff45', 'Leif Tilton', 'admin')
on conflict (id) do update set role = 'admin';
