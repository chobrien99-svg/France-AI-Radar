-- Rollback for supabase/migrations/20261106_project_brand_links.sql
-- Deletes the brand names, websites and LinkedIn links editors entered on
-- candidates. Deploy the previous code first: the current pages read these
-- columns. This file is never applied automatically.

ALTER TABLE projects DROP COLUMN IF EXISTS linkedin_url;
ALTER TABLE projects DROP COLUMN IF EXISTS website_url;
ALTER TABLE projects DROP COLUMN IF EXISTS brand_name;
