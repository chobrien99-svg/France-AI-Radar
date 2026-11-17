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
-- New objects only. Rollback: supabase/rollbacks/20261117_api_change_feed.sql

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
