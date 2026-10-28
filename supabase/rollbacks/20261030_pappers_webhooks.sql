-- Rollback for supabase/migrations/20261030_pappers_webhooks.sql
--
-- Deletes stored Pappers messages and the list of companies to vet.
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

DROP TABLE IF EXISTS monitoring_inbox;
DROP TABLE IF EXISTS company_leads;
ALTER TABLE monitoring_state DROP COLUMN IF EXISTS pappers_watched_siren;
