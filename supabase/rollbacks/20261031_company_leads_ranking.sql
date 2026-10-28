-- Rollback for supabase/migrations/20261031_company_leads_ranking.sql
-- Removes the scores, directory facts and research; the list itself is kept.
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

DROP INDEX IF EXISTS idx_company_leads_ranked;
ALTER TABLE company_leads
  DROP COLUMN IF EXISTS naf_code,
  DROP COLUMN IF EXISTS naf_label,
  DROP COLUMN IF EXISTS legal_form,
  DROP COLUMN IF EXISTS created_on,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS employer,
  DROP COLUMN IF EXISTS directors,
  DROP COLUMN IF EXISTS score,
  DROP COLUMN IF EXISTS score_reasons,
  DROP COLUMN IF EXISTS checked_at,
  DROP COLUMN IF EXISTS research,
  DROP COLUMN IF EXISTS researched_at;
