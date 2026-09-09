-- Teams and team_members tables for shared portal access
-- Paste this into the Supabase SQL editor and click Run

CREATE TABLE IF NOT EXISTS teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  brokerage   text,
  created_by  uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  contact_id  uuid        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  invited_by  uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  joined_at   timestamptz DEFAULT now(),
  UNIQUE(team_id, contact_id)
);
