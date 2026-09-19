-- ============================================================
-- One-time backfill: link existing shoots to the realtor's portal
-- account when the contact registered AFTER the shoot was created.
-- Run this whole file once in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → Run). Safe to run more
-- than once (idempotent).
-- ============================================================

-- Root cause: shoots.client_id is what the client portal's shoot query
-- filters on (RLS: "Client sees own shoots" using auth.uid() = client_id).
-- A shoot created for a contact_id before that contact had a portal
-- account only gets contact_id, not client_id — and there was no step
-- that went back and filled it in once they registered. Fixed going
-- forward in src/app/api/auth/link-contact/route.ts (commit ee8d46d);
-- this catches every contact who already registered before that fix
-- shipped, e.g. Jules Fernandez (contact ce202021-1564-4393-8e95-a75383a14e01,
-- 5 shoots, all client_id null despite her portal account existing).

update public.shoots
set client_id = c.user_id
from public.contacts c
where shoots.contact_id = c.id
  and c.user_id is not null
  and shoots.client_id is null;
