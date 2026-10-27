-- Signal monitoring: a nightly job looks for news about every AI Radar startup
-- (BODACC filings, French tech press, Google News), has Claude draft a signal
-- for each credible find, and queues it here for an admin to approve or reject.
-- Nothing in these tables is public: approved drafts are copied into signals.
-- How it works: docs/signal-monitoring.md
--
-- Additive only: no existing table or column is changed.
-- Safe to run twice: IF NOT EXISTS everywhere, policies dropped and recreated.
-- Rollback: supabase/rollbacks/20261028_signal_monitoring.sql

-- ------------------------------------------------------------------
-- 1. Review queue
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signal_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('bodacc', 'press_rss', 'google_news')),
  source_url TEXT NOT NULL,
  source_name TEXT,
  source_published_at TIMESTAMPTZ,
  raw_title TEXT NOT NULL,
  raw_excerpt TEXT,
  -- Claude's proposal, editable by the reviewer before approval
  signal_type signal_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  signal_date DATE,
  strength INT CHECK (strength BETWEEN 1 AND 5),
  funding_amount_eur NUMERIC,           -- millions of euros, as in funding_rounds
  funding_stage funding_stage,
  investors TEXT,
  confidence NUMERIC(3, 2) CHECK (confidence BETWEEN 0 AND 1),
  ai_reasoning TEXT,
  possible_duplicate_signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
  -- dismissed: Claude judged it a namesake or not credible. Kept so the same
  -- item isn't re-read every night, and so an admin can still approve it.
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_url)
);
CREATE INDEX IF NOT EXISTS idx_signal_candidates_status ON signal_candidates (status, created_at DESC);

-- ------------------------------------------------------------------
-- 2. Per-startup monitoring settings and progress
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitoring_state (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  search_aliases TEXT[] NOT NULL DEFAULT '{}',   -- other names to look for (brand, product)
  exclude_terms TEXT[] NOT NULL DEFAULT '{}',    -- words that mark a false match
  last_checked_at TIMESTAMPTZ,
  last_bodacc_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- 3. Run log, to see whether the nightly job is healthy
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitoring_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'cron' CHECK (kind IN ('cron', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  orgs_checked INT NOT NULL DEFAULT 0,
  items_seen INT NOT NULL DEFAULT 0,
  items_analyzed INT NOT NULL DEFAULT 0,
  candidates_created INT NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_monitoring_runs_started ON monitoring_runs (started_at DESC);

-- ------------------------------------------------------------------
-- 4. Admin-only: RLS on and no policies, so only the service-role client
--    (admin API routes and the cron job) can read or write.
-- ------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['signal_candidates', 'monitoring_state', 'monitoring_runs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
  END LOOP;
END $$;
