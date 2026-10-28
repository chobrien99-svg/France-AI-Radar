-- Pappers as a signal monitoring source: register events (documents filed,
-- new directors, capital changes, closure) read from the Pappers API.
-- How it works: docs/signal-monitoring.md
--
-- Requires 20261028_signal_monitoring.sql. Safe to run twice.
-- Rollback: supabase/rollbacks/20261029_pappers_monitoring.sql

-- Drafts found through Pappers are labelled 'pappers'.
ALTER TABLE signal_candidates DROP CONSTRAINT IF EXISTS signal_candidates_source_check;
ALTER TABLE signal_candidates ADD CONSTRAINT signal_candidates_source_check
  CHECK (source IN ('bodacc', 'press_rss', 'google_news', 'pappers'));

-- When each startup's Pappers record was last read (1 credit per read), and
-- what it said, so the next read can spot a capital change or a closure.
ALTER TABLE monitoring_state ADD COLUMN IF NOT EXISTS last_pappers_at TIMESTAMPTZ;
ALTER TABLE monitoring_state ADD COLUMN IF NOT EXISTS pappers_seen JSONB;
