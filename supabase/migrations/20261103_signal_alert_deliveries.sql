-- Signal alerts: subscribers who click "Set Alert" on a startup get a daily
-- email listing the startup's new signals. This table records which signal
-- was emailed to which user, so nobody gets the same signal twice and two
-- overlapping runs can't double-send (a run claims the row before sending,
-- and deletes its claim if the email fails).
-- How it works: lib/signal-alerts.ts
--
-- Additive only: no existing table or column is changed.
-- Safe to run twice. Rollback: supabase/rollbacks/20261103_signal_alert_deliveries.sql

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, signal_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_signal ON alert_deliveries (signal_id);

-- Server-only, like the monitoring tables: RLS on and no policies, so only
-- the service-role client (the daily job) can read or write.
ALTER TABLE alert_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON alert_deliveries FROM anon, authenticated;
