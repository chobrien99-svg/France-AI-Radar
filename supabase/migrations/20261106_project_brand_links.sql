-- Early detection: what an editor finds out about a pre-company project
-- before it is a registered company — the brand it uses, its website and its
-- LinkedIn page (e.g. i-PhD laureate TATOUAI trading as Izena).
-- Entered on Admin › Candidates; every change is kept in the candidate's
-- history. The projects table is staff-only, so none of this is public.
--
-- Additive only, safe to run twice. Requires 20261104_early_detection_foundation.sql.
-- Apply before deploying the code that reads these columns.
-- Rollback: supabase/rollbacks/20261106_project_brand_links.sql

ALTER TABLE projects ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Well-formed values only (the app normalizes before saving).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_brand_name_check') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_brand_name_check CHECK (brand_name IS NULL OR char_length(brand_name) BETWEEN 1 AND 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_website_url_check') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_website_url_check CHECK (website_url IS NULL OR website_url ~ '^https?://[^/\s]+\.[^/\s]+');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_linkedin_url_check') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_linkedin_url_check CHECK (linkedin_url IS NULL OR linkedin_url ~ '^https://([a-z0-9-]+\.)?linkedin\.com/');
  END IF;
END $$;
