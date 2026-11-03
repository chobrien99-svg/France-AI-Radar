-- Rollback for supabase/migrations/20261104_early_detection_foundation.sql
--
-- Removes the Early Detection tables and matching functions. This DELETES
-- every source record read so far, every candidate with its evidence,
-- identity proposals and audit trail, and the private projects and awards.
-- No public table is touched: the migration never wrote to one.
-- Set EARLY_DETECTION_ENABLED off (or remove /api/cron/ingest-sources from
-- vercel.json) first, so the daily job doesn't run against missing tables.
--
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

DROP FUNCTION IF EXISTS public.detection_match_people(TEXT, INT);
DROP FUNCTION IF EXISTS public.detection_match_organizations(TEXT, TEXT[], INT);

DROP TABLE IF EXISTS candidate_events;
DROP TABLE IF EXISTS candidate_subjects;
DROP TABLE IF EXISTS candidate_evidence;
DROP TABLE IF EXISTS detection_candidates;
DROP TABLE IF EXISTS external_identities;
DROP TABLE IF EXISTS awards;
DROP TABLE IF EXISTS project_links;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS ingestion_failures;
DROP TABLE IF EXISTS source_records;
DROP TABLE IF EXISTS ingestion_runs;
DROP TABLE IF EXISTS detection_sources;
