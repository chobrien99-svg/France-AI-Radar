-- Rollback for supabase/migrations/20261025_technical_taxonomy.sql
--
-- Removes the technical taxonomy tables and the four technology columns on
-- organization_profiles. This DELETES every technical classification entered
-- since the migration: export them first if they matter.
-- organizations.technology_layer was never touched, so nothing to restore.
--
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

DROP TABLE IF EXISTS organization_technology_claims;
DROP TABLE IF EXISTS organization_technical_terms;
DROP TABLE IF EXISTS organization_technical_layers;
DROP TABLE IF EXISTS technical_term_aliases;
DROP TABLE IF EXISTS technical_terms;
DROP TABLE IF EXISTS technical_layers;

ALTER TABLE organization_profiles DROP CONSTRAINT IF EXISTS organization_profiles_ai_product_role_check;
ALTER TABLE organization_profiles DROP CONSTRAINT IF EXISTS organization_profiles_technology_positioning_check;
ALTER TABLE organization_profiles DROP CONSTRAINT IF EXISTS organization_profiles_technology_maturity_check;
ALTER TABLE organization_profiles DROP CONSTRAINT IF EXISTS organization_profiles_technology_differentiation_check;
ALTER TABLE organization_profiles DROP COLUMN IF EXISTS ai_product_role;
ALTER TABLE organization_profiles DROP COLUMN IF EXISTS technology_positioning;
ALTER TABLE organization_profiles DROP COLUMN IF EXISTS technology_maturity;
ALTER TABLE organization_profiles DROP COLUMN IF EXISTS technology_differentiation;
