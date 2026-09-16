-- File Archive — a shared "Google Drive" for Ryan and Leif's business
-- files (contracts, tax docs, insurance, etc), reachable from My Nocturne.
-- Files live in R2 (R2_MEDIA_BUCKET, under the "archive/" prefix); these
-- tables are just the folder tree + metadata pointing at those objects.

CREATE TABLE IF NOT EXISTS archive_folders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  parent_id        uuid REFERENCES archive_folders(id) ON DELETE CASCADE,
  created_by       uuid NOT NULL,
  created_by_name  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_archive_folders_parent ON archive_folders (parent_id);

CREATE TABLE IF NOT EXISTS archive_files (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id        uuid REFERENCES archive_folders(id) ON DELETE CASCADE,
  name             text NOT NULL,
  file_key         text NOT NULL,   -- R2 object key
  size_bytes       bigint NOT NULL DEFAULT 0,
  content_type     text,
  uploaded_by      uuid NOT NULL,
  uploaded_by_name text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_archive_files_folder ON archive_files (folder_id);
CREATE INDEX IF NOT EXISTS idx_archive_files_name ON archive_files (name);

-- Reads/writes go through /api/archive (service-role + admin check), same
-- pattern as availability_blocks — RLS on, no policies, so only the
-- service-role key (server-side) can touch these tables.
ALTER TABLE archive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_files ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
