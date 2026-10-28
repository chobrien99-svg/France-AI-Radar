-- Rollback for supabase/migrations/20261028_signal_monitoring.sql
--
-- Removes the signal monitoring tables. This DELETES every pending or
-- reviewed draft, the per-startup aliases and exclude words, and the run log.
-- Signals already approved live in the signals table and are kept.
--
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

DROP TABLE IF EXISTS signal_candidates;
DROP TABLE IF EXISTS monitoring_state;
DROP TABLE IF EXISTS monitoring_runs;
