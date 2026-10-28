-- Rollback for supabase/migrations/20261029_pappers_monitoring.sql
--
-- Deletes the drafts found through Pappers (approved ones already live in
-- the signals table and are kept), then removes the Pappers columns.
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

DELETE FROM signal_candidates WHERE source = 'pappers';
ALTER TABLE signal_candidates DROP CONSTRAINT IF EXISTS signal_candidates_source_check;
ALTER TABLE signal_candidates ADD CONSTRAINT signal_candidates_source_check
  CHECK (source IN ('bodacc', 'press_rss', 'google_news'));
ALTER TABLE monitoring_state DROP COLUMN IF EXISTS last_pappers_at;
ALTER TABLE monitoring_state DROP COLUMN IF EXISTS pappers_seen;
