-- ============================================
-- Add signal_source_type enum and column
-- ============================================

CREATE TYPE signal_source_type AS ENUM (
  'stealth',
  'incorporated',
  'accelerator',
  'incubator',
  'france_2030_laureat'
);

ALTER TABLE startups
  ADD COLUMN IF NOT EXISTS signal_source signal_source_type;

-- first_seen_at already exists in the schema (DATE DEFAULT CURRENT_DATE),
-- but add it safely in case this migration runs on a DB without it.
ALTER TABLE startups
  ADD COLUMN IF NOT EXISTS first_seen_at DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_startups_signal_source ON startups(signal_source);
