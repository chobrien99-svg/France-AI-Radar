-- Early detection: when a source's history import is really finished.
--
-- Before: a source left "history mode" after its first run that wasn't a
-- total failure, even if some items couldn't be read. A historical item read
-- correctly on a later run was then labelled as a new find.
--
-- Now a source stays in history mode (everything it stores is marked as
-- history, not news) until a history-mode run has finished and no item that
-- failed during history mode is still unresolved. A failed item is resolved
-- when a later run reads it correctly, or when an editor dismisses it on
-- Admin › Sources. How it works: docs/early-detection.md
--
-- Additive only, safe to run twice. Requires 20261104_early_detection_foundation.sql.
-- Rollback: supabase/rollbacks/20261105_early_detection_history_state.sql

ALTER TABLE detection_sources ADD COLUMN IF NOT EXISTS history_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS is_history_import BOOLEAN NOT NULL DEFAULT false;
