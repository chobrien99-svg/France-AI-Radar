-- Ranking the companies to vet: facts from the government company directory,
-- a first-pass score with its reasons, and Claude's web research.
-- How it works: docs/signal-monitoring.md ("Companies to vet").
--
-- Requires 20261030_pappers_webhooks.sql. Safe to run twice.
-- Rollback: supabase/rollbacks/20261031_company_leads_ranking.sql

ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS naf_code TEXT;
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS naf_label TEXT;
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS legal_form TEXT;
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS created_on DATE;
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS employer BOOLEAN;
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS directors JSONB NOT NULL DEFAULT '[]';
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS score INT CHECK (score BETWEEN 0 AND 100);
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS score_reasons TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS research JSONB;
ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS researched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_company_leads_ranked ON company_leads (status, score DESC NULLS LAST, first_seen_at DESC);
