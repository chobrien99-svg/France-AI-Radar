-- Companies to vet: the trading or product name from the government
-- directory (e.g. FIVE ANGELS for ORAKLIA TECHNOLOGIES), which is often how a
-- new startup is known online. Safe to run twice.
-- Requires 20261031_company_leads_ranking.sql.
-- Rollback: supabase/rollbacks/20261101_company_leads_brand.sql

ALTER TABLE company_leads ADD COLUMN IF NOT EXISTS brand TEXT;
