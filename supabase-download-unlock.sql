-- ============================================================
-- Admin manual override: unlock a shoot's downloads/watermark
-- even if its invoice is still unpaid.
-- Run this whole file once in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → Run). Safe to run more
-- than once (idempotent).
-- ============================================================

alter table public.shoots
  add column if not exists download_unlocked boolean not null default false;
