-- Rollback for supabase/migrations/20261103_signal_alert_deliveries.sql
--
-- Removes the record of which signals were emailed to whom. Users' alerts
-- (the alerts table) are kept. If the daily alert job keeps running after
-- this, it fails and sends nothing (it cannot tell what was already sent),
-- so remove the /api/cron/signal-alerts entry from vercel.json first.
--
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

DROP TABLE IF EXISTS alert_deliveries;
