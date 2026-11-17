-- Assertions for public.api_record_changes. Fails loudly on the first mismatch.
CREATE OR REPLACE FUNCTION pg_temp.eq(label text, got anyelement, want anyelement) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL %: got %, want %', label, got, want; END IF; END $$;
CREATE OR REPLACE FUNCTION pg_temp.rec(t text, id text, h text, rec jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('entity_type', t, 'entity_id', id, 'hash', h, 'record', rec) $$;

TRUNCATE public.api_change_events, public.api_entity_state RESTART IDENTITY;
TRUNCATE public.organizations, public.signals, public.organization_merge_map;
INSERT INTO public.organizations VALUES
  ('00000000-0000-0000-0000-000000000001','A'), ('00000000-0000-0000-0000-000000000002','B'), ('00000000-0000-0000-0000-000000000003','C');
INSERT INTO public.signals VALUES ('00000000-0000-0000-0000-0000000000a1');

-- 1. First run: everything is created
SELECT public.api_record_changes(jsonb_build_array(
  pg_temp.rec('company','00000000-0000-0000-0000-000000000001','h1','{"name":"A","city":"Paris"}'),
  pg_temp.rec('company','00000000-0000-0000-0000-000000000002','h2','{"name":"B"}'),
  pg_temp.rec('company','00000000-0000-0000-0000-000000000003','h3','{"name":"C"}'),
  pg_temp.rec('signal','00000000-0000-0000-0000-0000000000a1','s1','{"title":"x"}')));
SELECT pg_temp.eq('created events', (SELECT count(*) FROM public.api_change_events WHERE event_type='created'), 4::bigint);
SELECT pg_temp.eq('seq order', (SELECT array_agg(seq ORDER BY seq) FROM public.api_change_events), ARRAY[1,2,3,4]::bigint[]);

-- 2. Same input again: no new events
SELECT public.api_record_changes(jsonb_build_array(
  pg_temp.rec('company','00000000-0000-0000-0000-000000000001','h1','{"name":"A","city":"Paris"}'),
  pg_temp.rec('company','00000000-0000-0000-0000-000000000002','h2','{"name":"B"}'),
  pg_temp.rec('company','00000000-0000-0000-0000-000000000003','h3','{"name":"C"}'),
  pg_temp.rec('signal','00000000-0000-0000-0000-0000000000a1','s1','{"title":"x"}')));
SELECT pg_temp.eq('idempotent', (SELECT count(*) FROM public.api_change_events), 4::bigint);

-- 3. A changes city; B is withdrawn (still exists); C is merged into A; the signal is deleted
DELETE FROM public.organizations WHERE id='00000000-0000-0000-0000-000000000003';
INSERT INTO public.organization_merge_map (organization_id, source_db, source_table, source_id)
  VALUES ('00000000-0000-0000-0000-000000000001','france_ai_radar','organizations','00000000-0000-0000-0000-000000000003');
DELETE FROM public.signals;
SELECT public.api_record_changes(jsonb_build_array(
  pg_temp.rec('company','00000000-0000-0000-0000-000000000001','h1b','{"name":"A","city":"Lyon"}')), 90, 1.0);
SELECT pg_temp.eq('update fields', (SELECT changed_fields FROM public.api_change_events WHERE event_type='updated'), ARRAY['city']);
SELECT pg_temp.eq('update version', (SELECT record_version FROM public.api_change_events WHERE event_type='updated'), 2);
SELECT pg_temp.eq('withdrawn B', (SELECT entity_id FROM public.api_change_events WHERE event_type='withdrawn'), '00000000-0000-0000-0000-000000000002'::uuid);
SELECT pg_temp.eq('merged C into A', (SELECT merged_into FROM public.api_change_events WHERE event_type='merged'), '00000000-0000-0000-0000-000000000001'::uuid);
SELECT pg_temp.eq('signal deleted', (SELECT count(*) FROM public.api_change_events WHERE event_type='deleted' AND entity_type='signal'), 1::bigint);
SELECT pg_temp.eq('no data kept once unpublished', (SELECT count(*) FROM public.api_entity_state WHERE NOT published AND (record IS NOT NULL OR hash IS NOT NULL)), 0::bigint);

-- 4. B is republished: created again with the next version
SELECT public.api_record_changes(jsonb_build_array(
  pg_temp.rec('company','00000000-0000-0000-0000-000000000001','h1b','{"name":"A","city":"Lyon"}'),
  pg_temp.rec('company','00000000-0000-0000-0000-000000000002','h2','{"name":"B"}')));
SELECT pg_temp.eq('republished version', (SELECT record_version FROM public.api_change_events WHERE entity_id='00000000-0000-0000-0000-000000000002' ORDER BY seq DESC LIMIT 1), 3);
SELECT pg_temp.eq('republished type', (SELECT event_type FROM public.api_change_events WHERE entity_id='00000000-0000-0000-0000-000000000002' ORDER BY seq DESC LIMIT 1), 'created');

-- 5. Safety net: an empty load with >= 10 published entities is refused and changes nothing
SELECT public.api_record_changes((SELECT jsonb_agg(pg_temp.rec('company', gen_random_uuid()::text, 'x', '{}')) FROM generate_series(1, 12)));
DO $$ DECLARE n bigint := (SELECT count(*) FROM public.api_change_events); BEGIN
  BEGIN
    PERFORM public.api_record_changes('[]'::jsonb);
    RAISE EXCEPTION 'FAIL safety net: empty load was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.api_change_events) <> n THEN RAISE EXCEPTION 'FAIL safety net changed data'; END IF;
END $$;

-- 6. Retention: old events are pruned and the watermark recorded
UPDATE public.api_change_events SET occurred_at = now() - interval '100 days' WHERE seq <= 2;
SELECT public.api_record_changes((SELECT jsonb_agg(jsonb_build_object('entity_type', entity_type, 'entity_id', entity_id, 'hash', hash, 'record', record)) FROM public.api_entity_state WHERE published));
SELECT pg_temp.eq('pruned_through', (SELECT pruned_through FROM public.api_sync_state), 2::bigint);
SELECT pg_temp.eq('last_seq', (SELECT last_seq FROM public.api_sync_state), (SELECT max(seq) FROM public.api_change_events));

-- 7. Browser roles have no access
SELECT pg_temp.eq('anon cannot read events', has_table_privilege('anon', 'public.api_change_events', 'SELECT'), false);
SELECT pg_temp.eq('authenticated cannot read state', has_table_privilege('authenticated', 'public.api_entity_state', 'SELECT'), false);
SELECT pg_temp.eq('anon cannot run the writer', has_function_privilege('anon', 'public.api_record_changes(jsonb, integer, numeric)', 'EXECUTE'), false);

SELECT 'api change feed: all assertions passed';
