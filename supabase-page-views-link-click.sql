-- Links a page_views row back to the link_clicks row that sent the visitor
-- there, so a tracked link's dwell time (page_views.duration_seconds) can be
-- shown next to that click in the Outreach engagement view.

alter table public.page_views add column if not exists link_click_id uuid references public.link_clicks(id) on delete set null;

create index if not exists page_views_link_click_id_idx on public.page_views(link_click_id);

-- Force PostgREST to pick up the new column right away.
notify pgrst, 'reload schema';
