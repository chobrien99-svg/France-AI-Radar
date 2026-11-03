-- Rollback for supabase/migrations/20261105_early_detection_history_state.sql
-- Deploy the previous code first: the current runner reads these columns.
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

ALTER TABLE ingestion_runs DROP COLUMN IF EXISTS is_history_import;
ALTER TABLE detection_sources DROP COLUMN IF EXISTS history_complete;
