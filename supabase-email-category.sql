-- Adds a category label to email_log so the Engagement page can show
-- which kind of email a lead is reacting to (Cold Call Follow-up, Portal
-- Invite, a specific outreach template, etc.). Older rows stay null and
-- fall back to a subject-based guess in the UI.

alter table public.email_log add column if not exists category text;

notify pgrst, 'reload schema';
