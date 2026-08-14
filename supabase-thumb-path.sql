-- Adds the column that stores the compressed public-bucket thumbnail path
-- for each media row. The upload route and gallery already handle this
-- column being missing (graceful fallback to full-res signed URLs), but
-- until this runs, no bandwidth-saving thumbnails are actually being used —
-- every gallery grid/lightbox view loads the full original instead.

alter table public.media add column if not exists thumb_path text;

-- Force PostgREST to pick up the new column right away.
notify pgrst, 'reload schema';
