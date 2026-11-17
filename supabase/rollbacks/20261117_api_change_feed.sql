-- Rollback for supabase/migrations/20261117_api_change_feed.sql.
-- Removes the change feed. Nothing else depends on these objects.
DROP FUNCTION IF EXISTS public.api_record_changes(jsonb, integer, numeric);
DROP TABLE IF EXISTS public.api_change_events;
DROP TABLE IF EXISTS public.api_entity_state;
DROP TABLE IF EXISTS public.api_sync_state;
