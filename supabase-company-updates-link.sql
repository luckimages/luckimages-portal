-- company_updates.insert({ ..., link: "..." }) has been used in several
-- routes (delivery invoice, booking request, booking confirmation, and
-- lib/notify.ts's postNotification) but the column never existed, so every
-- one of those inserts has been silently failing (Supabase/PostgREST
-- schema-mismatch errors aren't thrown by the client unless .error is
-- checked). The Command Center UI already reads `.link` per update to make
-- it clickable, so this was a real, intended feature — just missing.

alter table public.company_updates add column if not exists link text;

notify pgrst, 'reload schema';
