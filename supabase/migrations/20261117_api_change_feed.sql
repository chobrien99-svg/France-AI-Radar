-- Enterprise API, Stage 2: change feed for incremental sync.
--
-- How it works: a scheduled job (app/api/cron/api-changes) builds the
-- public JSON of every published company and signal with the API's own
-- serializer and passes it to public.api_record_changes(). The function
-- compares it with the last recorded state and appends one event per
-- change to api_change_events, under a lock, so the event sequence is the
-- commit order and a client cursor can never skip an event.
--
-- No trigger is added to any existing table: Navigator writes are not
-- affected in any way. Events contain field names only (never values) and
-- withdrawn/deleted events carry ids only.
--
-- New objects, plus one added statement in merge_organizations() (section 2)
-- so merges leave an alias. Rollback: supabase/rollbacks/20261117_api_change_feed.sql

CREATE TABLE IF NOT EXISTS public.api_entity_state (
  entity_type text NOT NULL CHECK (entity_type IN ('company', 'signal')),
  entity_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  hash text,
  record jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS public.api_change_events (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  entity_type text NOT NULL CHECK (entity_type IN ('company', 'signal')),
  entity_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated', 'withdrawn', 'deleted', 'merged')),
  record_version integer NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  merged_into uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_change_events_entity_idx ON public.api_change_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS api_change_events_occurred_idx ON public.api_change_events (occurred_at);

-- One row: when the feed last ran, and the highest seq removed by retention.
CREATE TABLE IF NOT EXISTS public.api_sync_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_run_at timestamptz,
  last_seq bigint NOT NULL DEFAULT 0,
  pruned_through bigint NOT NULL DEFAULT 0
);
INSERT INTO public.api_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Server-only tables: RLS on with no policies, no grants to browser roles.
ALTER TABLE public.api_entity_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_entity_state, public.api_change_events, public.api_sync_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_entity_state, public.api_change_events, public.api_sync_state TO service_role;

-- p_records: [{ "entity_type", "entity_id", "hash", "record" }, …], the
-- complete current set of published entities. Returns counts per event type.
CREATE OR REPLACE FUNCTION public.api_record_changes(
  p_records jsonb,
  p_retention_days integer DEFAULT 90,
  p_max_withdraw_ratio numeric DEFAULT 0.5
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  r record;
  s public.api_entity_state%ROWTYPE;
  v_type text;
  v_into uuid;
  v_fields text[];
  v_counts jsonb := '{"created":0,"updated":0,"withdrawn":0,"deleted":0,"merged":0}';
  v_published integer;
  v_missing integer;
  v_pruned bigint;
BEGIN
  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RAISE EXCEPTION 'p_records must be a JSON array';
  END IF;

  -- One writer at a time: events are numbered in commit order.
  PERFORM pg_advisory_xact_lock(hashtext('public.api_record_changes'));

  CREATE TEMP TABLE api_incoming ON COMMIT DROP AS
    SELECT x.entity_type, x.entity_id, x.hash, x.record
    FROM jsonb_to_recordset(p_records) AS x(entity_type text, entity_id uuid, hash text, record jsonb);
  CREATE INDEX ON api_incoming (entity_type, entity_id);

  -- Safety net: a failed or partial load must not withdraw the whole dataset.
  SELECT count(*) INTO v_published FROM public.api_entity_state WHERE published;
  SELECT count(*) INTO v_missing FROM public.api_entity_state st
    WHERE st.published AND NOT EXISTS (SELECT 1 FROM api_incoming i WHERE i.entity_type = st.entity_type AND i.entity_id = st.entity_id);
  IF v_published >= 10 AND v_missing > v_published * p_max_withdraw_ratio THEN
    RAISE EXCEPTION 'refusing to withdraw % of % published entities in one run', v_missing, v_published;
  END IF;

  -- New, republished and changed entities
  FOR r IN SELECT * FROM api_incoming ORDER BY entity_type, entity_id LOOP
    SELECT * INTO s FROM public.api_entity_state st WHERE st.entity_type = r.entity_type AND st.entity_id = r.entity_id FOR UPDATE;
    IF NOT FOUND OR NOT s.published THEN
      INSERT INTO public.api_entity_state AS st (entity_type, entity_id, version, published, hash, record, updated_at)
        VALUES (r.entity_type, r.entity_id, 1, true, r.hash, r.record, now())
        ON CONFLICT (entity_type, entity_id) DO UPDATE
          SET version = st.version + 1, published = true, hash = excluded.hash, record = excluded.record, updated_at = now();
      INSERT INTO public.api_change_events (entity_type, entity_id, event_type, record_version)
        SELECT r.entity_type, r.entity_id, 'created', st.version FROM public.api_entity_state st
        WHERE st.entity_type = r.entity_type AND st.entity_id = r.entity_id;
      v_counts := jsonb_set(v_counts, '{created}', to_jsonb((v_counts->>'created')::int + 1));
    ELSIF s.hash IS DISTINCT FROM r.hash THEN
      SELECT coalesce(array_agg(k ORDER BY k), '{}') INTO v_fields FROM (
        SELECT jsonb_object_keys(coalesce(r.record, '{}')) AS k
        UNION SELECT jsonb_object_keys(coalesce(s.record, '{}'))
      ) keys
      WHERE (r.record -> keys.k) IS DISTINCT FROM (s.record -> keys.k);
      UPDATE public.api_entity_state SET version = version + 1, hash = r.hash, record = r.record, updated_at = now()
        WHERE entity_type = r.entity_type AND entity_id = r.entity_id;
      INSERT INTO public.api_change_events (entity_type, entity_id, event_type, record_version, changed_fields)
        VALUES (r.entity_type, r.entity_id, 'updated', s.version + 1, v_fields);
      v_counts := jsonb_set(v_counts, '{updated}', to_jsonb((v_counts->>'updated')::int + 1));
    END IF;
  END LOOP;

  -- Entities that were published and no longer are
  FOR s IN SELECT st.* FROM public.api_entity_state st
           WHERE st.published AND NOT EXISTS (SELECT 1 FROM api_incoming i WHERE i.entity_type = st.entity_type AND i.entity_id = st.entity_id)
           ORDER BY st.entity_type, st.entity_id FOR UPDATE LOOP
    v_into := NULL;
    IF s.entity_type = 'company' THEN
      IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = s.entity_id) THEN
        v_type := 'withdrawn';
      ELSE
        SELECT m.organization_id INTO v_into FROM public.organization_merge_map m
          WHERE m.source_db = 'france_ai_radar' AND m.source_table = 'organizations' AND m.source_id = s.entity_id::text
          LIMIT 1;
        v_type := CASE WHEN v_into IS NOT NULL THEN 'merged' ELSE 'deleted' END;
      END IF;
    ELSE
      v_type := CASE WHEN EXISTS (SELECT 1 FROM public.signals g WHERE g.id = s.entity_id) THEN 'withdrawn' ELSE 'deleted' END;
    END IF;
    -- Keep no copy of data that is no longer published
    UPDATE public.api_entity_state SET version = version + 1, published = false, hash = NULL, record = NULL, updated_at = now()
      WHERE entity_type = s.entity_type AND entity_id = s.entity_id;
    INSERT INTO public.api_change_events (entity_type, entity_id, event_type, record_version, merged_into)
      VALUES (s.entity_type, s.entity_id, v_type, s.version + 1, v_into);
    v_counts := jsonb_set(v_counts, ARRAY[v_type], to_jsonb((v_counts->>v_type)::int + 1));
  END LOOP;

  -- Retention
  WITH gone AS (
    DELETE FROM public.api_change_events WHERE occurred_at < now() - make_interval(days => p_retention_days) RETURNING seq
  )
  SELECT max(seq) INTO v_pruned FROM gone;

  UPDATE public.api_sync_state SET
    last_run_at = now(),
    last_seq = coalesce((SELECT max(seq) FROM public.api_change_events), last_seq),
    pruned_through = greatest(pruned_through, coalesce(v_pruned, 0))
  WHERE id = 1;

  RETURN v_counts || jsonb_build_object('last_seq', (SELECT last_seq FROM public.api_sync_state WHERE id = 1));
END;
$$;

REVOKE ALL ON FUNCTION public.api_record_changes(jsonb, integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_record_changes(jsonb, integer, numeric) TO service_role;

-- 2. merge_organizations(): identical to the current definition (Navigator
-- supabase/migrations/phase12/04_merge_duplicate_orgs.sql) except for one
-- INSERT that records the merged id in organization_merge_map. Keep the
-- Navigator copy in step if that file is ever re-run.
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

  -- Remember the merged id, so the Enterprise API can report "merged" with
  -- merged_into and resolve the old id (added by 20261117_api_change_feed).
  INSERT INTO organization_merge_map (organization_id, source_db, source_table, source_id, notes)
  VALUES (tgt, 'france_ai_radar', 'organizations', src::text, format('Merged %s into %s (%s)', source_slug, target_slug, now()::date))
  ON CONFLICT (source_db, source_table, source_id) DO NOTHING;

  -- Finally delete the source org
  DELETE FROM organizations WHERE id = src;

  RETURN format('MERGED: %L → %L', source_slug, target_slug);
END;
$function$;
