-- D1: narrow what the public (anon) key and non-team accounts can read.
--
-- Background (Stage 0 audit, docs/enterprise-api/stage-0-audit.md):
-- several tables had a "Public read access" policy of USING (true), so
-- anyone holding the anon key shipped to browsers could read them.
--
-- Most of that is public on purpose: the Navigator publishes funding
-- rounds, their companies, investors and founders through
-- /api/public/v1/funding, the funding-hub and Next 40 embeds, and the
-- quarterly deals-database pages. Those reads keep working unchanged.
-- What was NOT meant to be public, and is closed here:
--
--   1. program_organizations rows marked verification_status = 'private'
--      (e.g. the editor-only F/ai Batch 2 cohort).
--   2. The Radar's technology intelligence: organization_technical_terms,
--      organization_technical_layers and organization_technology_claims.
--      No public page reads these; the Radar reads them with the service
--      role and the Navigator with a signed-in team session.
--   3. Funding rounds (and their investor rows) that are not published.
--      Every round is published today, so nothing disappears now; this
--      stops future unpublished rounds from leaking.
--
-- The Navigator team (is_navigator_team(): confirmed @frenchtechjournal.com
-- accounts, the same rule as the Navigator's login check) keeps full read
-- access to every table. The service role bypasses RLS, so the Radar
-- website and all cron jobs are unaffected.
--
-- Only policies change: no table, column, grant or data changes.
-- Rollback: supabase/rollbacks/20261108_narrow_public_read.sql

-- 1. Program memberships: hide private rows from everyone but the team.
DROP POLICY IF EXISTS "Public read access" ON public.program_organizations;
CREATE POLICY "Public read of non-private memberships" ON public.program_organizations
  FOR SELECT TO anon, authenticated
  USING (verification_status IS DISTINCT FROM 'private' OR (SELECT public.is_navigator_team()));

-- 2. Radar technology intelligence: team only.
DROP POLICY IF EXISTS "Public read access" ON public.organization_technical_terms;
CREATE POLICY "Navigator team read access" ON public.organization_technical_terms
  FOR SELECT TO authenticated
  USING ((SELECT public.is_navigator_team()));

DROP POLICY IF EXISTS "Public read access" ON public.organization_technical_layers;
CREATE POLICY "Navigator team read access" ON public.organization_technical_layers
  FOR SELECT TO authenticated
  USING ((SELECT public.is_navigator_team()));

DROP POLICY IF EXISTS "Public read access" ON public.organization_technology_claims;
CREATE POLICY "Navigator team read access" ON public.organization_technology_claims
  FOR SELECT TO authenticated
  USING ((SELECT public.is_navigator_team()));

-- 3. Funding: only published rounds (and their investors) outside the team.
DROP POLICY IF EXISTS "Public read access" ON public.funding_rounds;
CREATE POLICY "Public read of published rounds" ON public.funding_rounds
  FOR SELECT TO anon, authenticated
  USING (publish_status = 'published' OR (SELECT public.is_navigator_team()));

DROP POLICY IF EXISTS "Public read access" ON public.funding_round_investors;
CREATE POLICY "Public read of published round investors" ON public.funding_round_investors
  FOR SELECT TO anon, authenticated
  USING (
    (SELECT public.is_navigator_team())
    OR EXISTS (
      SELECT 1 FROM public.funding_rounds fr
      WHERE fr.id = funding_round_investors.funding_round_id
        AND fr.publish_status = 'published'
    )
  );
