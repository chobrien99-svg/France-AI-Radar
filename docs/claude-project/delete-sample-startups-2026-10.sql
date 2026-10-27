-- Removes the five demo startups that supabase/seed.sql created during the
-- original project setup: Axone, BioSight, NovaMind AI, Revero Health and
-- SentinelOps. (Katrix.AI also came from that file but has since become a
-- real profile, so it is not touched.)
--
-- Safety: the script stops and deletes nothing if any of the five is
-- published, has a website, or has founders, funding rounds or articles
-- attached. Everything else linked to them (profile, sample signals, sample
-- legal entities, sectors, tags) is removed automatically with them.

BEGIN;

DO $$
DECLARE
  targets TEXT[] := ARRAY['axone','biosight','novamind-ai','revero-health','sentinelops'];
  problem TEXT;
BEGIN
  SELECT string_agg(o.name || ' (' || reason || ')', ', ') INTO problem
  FROM organizations o
  CROSS JOIN LATERAL (VALUES
    (CASE WHEN o.status = 'active' THEN 'published' END),
    (CASE WHEN o.website IS NOT NULL THEN 'has a website' END),
    (CASE WHEN EXISTS (SELECT 1 FROM organization_people x WHERE x.organization_id = o.id) THEN 'has founders' END),
    (CASE WHEN EXISTS (SELECT 1 FROM funding_rounds x WHERE x.organization_id = o.id) THEN 'has funding rounds' END),
    (CASE WHEN EXISTS (SELECT 1 FROM funding_round_investors x WHERE x.investor_id = o.id) THEN 'listed as an investor' END),
    (CASE WHEN EXISTS (SELECT 1 FROM article_organizations x WHERE x.organization_id = o.id) THEN 'linked to articles' END)
  ) r(reason)
  WHERE o.slug = ANY(targets) AND r.reason IS NOT NULL;

  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Nothing deleted. These look like they may be real: %', problem;
  END IF;

  DELETE FROM organizations WHERE slug = ANY(targets);
END $$;

COMMIT;

-- Check: should return no rows.
SELECT name, slug FROM organizations
WHERE slug IN ('axone','biosight','novamind-ai','revero-health','sentinelops');
