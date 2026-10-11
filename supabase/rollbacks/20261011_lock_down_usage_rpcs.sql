-- Rollback for supabase/migrations/20261011_lock_down_usage_rpcs.sql
--
-- Restores the three functions exactly as they were on 2026-10-11 before the
-- migration, including EXECUTE for anon / PUBLIC. Only run this if the
-- migration broke something: it reopens the security hole.
--
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

CREATE OR REPLACE FUNCTION public.record_profile_view(p_user_id uuid, p_organization_id uuid, p_period text)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  INSERT INTO profile_views (user_id, organization_id, period)
    VALUES (p_user_id, p_organization_id, p_period)
  ON CONFLICT (user_id, organization_id, period) DO NOTHING;

  SELECT COUNT(DISTINCT organization_id)::INTEGER
  FROM profile_views
  WHERE user_id = p_user_id AND period = p_period;
$function$;
ALTER FUNCTION public.record_profile_view(uuid, uuid, text) RESET ALL;

CREATE OR REPLACE FUNCTION public.get_profile_view_count(p_user_id uuid, p_period text)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT COUNT(DISTINCT organization_id)::INTEGER
  FROM profile_views
  WHERE user_id = p_user_id AND period = p_period;
$function$;
ALTER FUNCTION public.get_profile_view_count(uuid, text) RESET ALL;
ALTER FUNCTION public.get_profile_view_count(uuid, text) VOLATILE;

CREATE OR REPLACE FUNCTION public.increment_export_usage(p_user_id uuid, p_period text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO export_usage (user_id, period, export_count)
  VALUES (p_user_id, p_period, 1)
  ON CONFLICT (user_id, period)
  DO UPDATE SET export_count = export_usage.export_count + 1;
END;
$function$;
ALTER FUNCTION public.increment_export_usage(uuid, text) RESET ALL;

GRANT EXECUTE ON FUNCTION public.record_profile_view(uuid, uuid, text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_profile_view_count(uuid, text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_export_usage(uuid, text) TO PUBLIC, anon, authenticated, service_role;
