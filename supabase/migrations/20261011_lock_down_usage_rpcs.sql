-- Lock down the profile-view and export-usage functions.
--
-- These three functions are SECURITY DEFINER (they run with the owner's
-- rights, bypassing row-level security) and take the target user as a
-- parameter. Until now anyone holding the public anon key could call them
-- for any user id, e.g. to burn through a customer's export allowance.
--
-- After this migration:
--   * anon / PUBLIC can no longer execute any of them.
--   * increment_export_usage is service-role only (the CSV export route
--     calls it with the service client after its own auth checks).
--   * record_profile_view and get_profile_view_count stay callable by
--     signed-in users, but only for themselves (p_user_id must equal
--     auth.uid()). The service role may still pass any user id.
--   * search_path is pinned and table names are schema-qualified.
--
-- Signatures and return types are unchanged, so existing callers keep
-- working. Rollback: supabase/rollbacks/20261011_lock_down_usage_rpcs.sql

-- record_profile_view: called from app/startup/[slug]/page.tsx with the
-- signed-in user's session.
CREATE OR REPLACE FUNCTION public.record_profile_view(p_user_id uuid, p_organization_id uuid, p_period text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  view_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.profile_views (user_id, organization_id, period)
    VALUES (p_user_id, p_organization_id, p_period)
  ON CONFLICT (user_id, organization_id, period) DO NOTHING;

  SELECT COUNT(DISTINCT organization_id)::integer INTO view_count
  FROM public.profile_views
  WHERE user_id = p_user_id AND period = p_period;

  RETURN view_count;
END;
$$;

-- get_profile_view_count: not called by this codebase; kept for other
-- callers, with the same self-only rule.
CREATE OR REPLACE FUNCTION public.get_profile_view_count(p_user_id uuid, p_period text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COUNT(DISTINCT organization_id)::integer
    FROM public.profile_views
    WHERE user_id = p_user_id AND period = p_period
  );
END;
$$;

-- increment_export_usage: called from app/api/startup/[slug]/export-csv/route.ts
-- with the service-role client. Body unchanged apart from schema-qualifying.
CREATE OR REPLACE FUNCTION public.increment_export_usage(p_user_id uuid, p_period text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.export_usage (user_id, period, export_count)
  VALUES (p_user_id, p_period, 1)
  ON CONFLICT (user_id, period)
  DO UPDATE SET export_count = public.export_usage.export_count + 1;
END;
$$;

-- Permissions
REVOKE EXECUTE ON FUNCTION public.record_profile_view(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_view_count(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_export_usage(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_profile_view(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_profile_view_count(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_export_usage(uuid, text) TO service_role;
