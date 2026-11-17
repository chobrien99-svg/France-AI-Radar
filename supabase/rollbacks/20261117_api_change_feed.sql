-- Rollback for supabase/migrations/20261117_api_change_feed.sql.
-- Removes the change feed. Nothing else depends on these objects.
DROP FUNCTION IF EXISTS public.api_record_changes(jsonb, integer, numeric);
DROP TABLE IF EXISTS public.api_change_events;
DROP TABLE IF EXISTS public.api_entity_state;
DROP TABLE IF EXISTS public.api_sync_state;

-- Restore merge_organizations() exactly as it was before the migration.
CREATE OR REPLACE FUNCTION public.merge_organizations(source_slug text, target_slug text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  src UUID;
  tgt UUID;
BEGIN
  SELECT id INTO src FROM organizations WHERE slug = source_slug;
  SELECT id INTO tgt FROM organizations WHERE slug = target_slug;

  IF src IS NULL THEN
    RETURN format('SKIPPED: source org %L not found (already merged?)', source_slug);
  END IF;
  IF tgt IS NULL THEN
    RETURN format('ABORT: target org %L not found', target_slug);
  END IF;
  IF src = tgt THEN
    RETURN format('SKIPPED: %L and %L resolve to the same org', source_slug, target_slug);
  END IF;

  -- legal_entities (no unique constraint at the DB level on (org, siren),
  -- but we still avoid creating duplicate rows for the same SIREN under target).
  UPDATE legal_entities le SET organization_id = tgt
   WHERE le.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM legal_entities le2
       WHERE le2.organization_id = tgt AND le2.siren IS NOT DISTINCT FROM le.siren
     );
  DELETE FROM legal_entities WHERE organization_id = src;

  -- program_organizations: UNIQUE(program_edition_id, organization_id)
  UPDATE program_organizations po SET organization_id = tgt
   WHERE po.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM program_organizations po2
       WHERE po2.organization_id = tgt AND po2.program_edition_id = po.program_edition_id
     );
  DELETE FROM program_organizations WHERE organization_id = src;

  -- funding_rounds: no unique constraint, just transfer all
  UPDATE funding_rounds SET organization_id = tgt WHERE organization_id = src;

  -- organization_sectors: UNIQUE(organization_id, sector_id)
  UPDATE organization_sectors os SET organization_id = tgt
   WHERE os.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM organization_sectors os2
       WHERE os2.organization_id = tgt AND os2.sector_id = os.sector_id
     );
  DELETE FROM organization_sectors WHERE organization_id = src;

  -- organization_tags: UNIQUE(organization_id, tag)
  UPDATE organization_tags ot SET organization_id = tgt
   WHERE ot.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM organization_tags ot2
       WHERE ot2.organization_id = tgt AND ot2.tag = ot.tag
     );
  DELETE FROM organization_tags WHERE organization_id = src;

  -- organization_people: UNIQUE(organization_id, person_id, role)
  UPDATE organization_people op SET organization_id = tgt
   WHERE op.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM organization_people op2
       WHERE op2.organization_id = tgt AND op2.person_id = op.person_id AND op2.role = op.role
     );
  DELETE FROM organization_people WHERE organization_id = src;

  -- organization_events / grants / patents / products / signals / alerts:
  -- no unique constraint involving organization_id, transfer all
  UPDATE organization_events SET organization_id = tgt WHERE organization_id = src;
  UPDATE grants              SET organization_id = tgt WHERE organization_id = src;
  UPDATE patents             SET organization_id = tgt WHERE organization_id = src;
  UPDATE products            SET organization_id = tgt WHERE organization_id = src;
  UPDATE signals             SET organization_id = tgt WHERE organization_id = src;
  UPDATE alerts              SET organization_id = tgt WHERE organization_id = src;

  -- person_experience.organization_id (ON DELETE SET NULL) — transfer all
  UPDATE person_experience SET organization_id = tgt WHERE organization_id = src;

  -- article_organizations: UNIQUE(article_id, organization_id)
  UPDATE article_organizations ao SET organization_id = tgt
   WHERE ao.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM article_organizations ao2
       WHERE ao2.article_id = ao.article_id AND ao2.organization_id = tgt
     );
  DELETE FROM article_organizations WHERE organization_id = src;

  -- list_items: UNIQUE(list_id, organization_id)
  UPDATE list_items li SET organization_id = tgt
   WHERE li.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM list_items li2
       WHERE li2.list_id = li.list_id AND li2.organization_id = tgt
     );
  DELETE FROM list_items WHERE organization_id = src;

  -- watchlist: UNIQUE(user_id, organization_id)
  UPDATE watchlist w SET organization_id = tgt
   WHERE w.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM watchlist w2
       WHERE w2.user_id = w.user_id AND w2.organization_id = tgt
     );
  DELETE FROM watchlist WHERE organization_id = src;

  -- organization_profiles: UNIQUE(organization_id) — at most one row per org.
  -- Move src's profile to tgt only if tgt has none; otherwise delete src's.
  UPDATE organization_profiles op SET organization_id = tgt
   WHERE op.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM organization_profiles op2 WHERE op2.organization_id = tgt
     );
  DELETE FROM organization_profiles WHERE organization_id = src;

  -- funding_round_investors: src as INVESTOR in some round.
  -- UNIQUE(funding_round_id, investor_id).
  UPDATE funding_round_investors fri SET investor_id = tgt
   WHERE fri.investor_id = src
     AND NOT EXISTS (
       SELECT 1 FROM funding_round_investors fri2
       WHERE fri2.funding_round_id = fri.funding_round_id AND fri2.investor_id = tgt
     );
  DELETE FROM funding_round_investors WHERE investor_id = src;

  -- organization_relationships: org may appear as source_org_id or target_org_id.
  -- CHECK (source_org_id <> target_org_id) means we must first delete any row
  -- that would become source=target after the redirect.
  DELETE FROM organization_relationships
   WHERE (source_org_id = src AND target_org_id = tgt)
      OR (source_org_id = tgt AND target_org_id = src);
  UPDATE organization_relationships SET source_org_id = tgt WHERE source_org_id = src;
  UPDATE organization_relationships SET target_org_id = tgt WHERE target_org_id = src;

  -- organization_merge_map: provenance log; UNIQUE(source_db, source_table, source_id).
  -- Redirect rows from src to tgt where they wouldn't collide with an existing
  -- (source_db, source_table, source_id) under tgt.
  UPDATE organization_merge_map omm SET organization_id = tgt
   WHERE omm.organization_id = src
     AND NOT EXISTS (
       SELECT 1 FROM organization_merge_map omm2
       WHERE omm2.organization_id = tgt
         AND omm2.source_db = omm.source_db
         AND omm2.source_table = omm.source_table
         AND omm2.source_id = omm.source_id
     );
  DELETE FROM organization_merge_map WHERE organization_id = src;

  -- Enrich the target with any non-null source fields it's currently missing
  UPDATE organizations o SET
    website      = COALESCE(o.website,      src_o.website),
    description  = COALESCE(o.description,  src_o.description),
    legacy_id    = COALESCE(o.legacy_id,    src_o.legacy_id),
    city_id      = COALESCE(o.city_id,      src_o.city_id),
    founded_date = COALESCE(o.founded_date, src_o.founded_date),
    updated_at   = NOW()
  FROM organizations src_o
  WHERE o.id = tgt AND src_o.id = src;

  -- Finally delete the source org
  DELETE FROM organizations WHERE id = src;

  RETURN format('MERGED: %L → %L', source_slug, target_slug);
END;
$function$;
