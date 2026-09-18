-- OPTIONAL. Sequences and tags were removed from Nocturne on 2026-09-17.
-- The app no longer reads or writes any of this, so leaving it alone is
-- harmless — run this only if you want the unused tables/column gone.
-- This permanently deletes them and can't be undone.

drop table if exists public.sequence_enrollments;
drop table if exists public.sequences;
alter table public.contacts drop column if exists tags;

notify pgrst, 'reload schema';
