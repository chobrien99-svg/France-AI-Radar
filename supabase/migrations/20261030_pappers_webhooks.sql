-- Pappers webhooks: Pappers sends a message when a watched Radar startup
-- changes (surveillance list) or when a saved search ("veille", e.g. new
-- SAS companies whose stated purpose mentions AI) gains companies.
-- Messages are stored as received and read by the nightly monitoring run.
-- How it works: docs/signal-monitoring.md
--
-- Requires 20261029_pappers_monitoring.sql. Safe to run twice.
-- Rollback: supabase/rollbacks/20261030_pappers_webhooks.sql

-- Messages from Pappers, exactly as received.
CREATE TABLE IF NOT EXISTS monitoring_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement TEXT NOT NULL,
  list_id TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_monitoring_inbox_unprocessed ON monitoring_inbox (received_at) WHERE processed_at IS NULL;

-- Companies a saved search found, for an admin to vet for the Radar.
CREATE TABLE IF NOT EXISTS company_leads (
  siren TEXT PRIMARY KEY CHECK (siren ~ '^[0-9]{9}$'),
  name TEXT,
  list_name TEXT,
  is_new_company BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'added', 'ignored')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_company_leads_status ON company_leads (status, first_seen_at DESC);

-- Which SIREN is on the Pappers watch list for each startup.
ALTER TABLE monitoring_state ADD COLUMN IF NOT EXISTS pappers_watched_siren TEXT;

-- Admin-only, like the other monitoring tables.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['monitoring_inbox', 'company_leads'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
  END LOOP;
END $$;
