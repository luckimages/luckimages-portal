-- Google Calendar event id for a shoot.
--
-- When a shoot is confirmed we create an event on ryan@luckimages.com and
-- invite Leif + the client + assigned photographers. Storing the event id
-- lets us delete that event (with a cancellation notice to attendees) when
-- the shoot is later cancelled, instead of leaving a ghost event with live
-- reminders on everyone's calendar.
--
-- Application code degrades gracefully when this column is absent, so
-- running this is safe at any time and only needs to happen once per
-- environment.

ALTER TABLE shoots ADD COLUMN IF NOT EXISTS calendar_event_id text;
