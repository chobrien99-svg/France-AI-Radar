-- Rollback for supabase/migrations/20261101_company_leads_brand.sql
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

ALTER TABLE company_leads DROP COLUMN IF EXISTS brand;
