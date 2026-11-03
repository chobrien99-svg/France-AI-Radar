-- Assertions for 20261104_early_detection_foundation.sql. Each check raises
-- an exception (and stops the run) on failure; passing checks print NOTICEs.
DO $$
DECLARE
  t TEXT;
  n INT;
  src UUID;
  rec UUID;
  cand UUID;
  proj UUID;
BEGIN
  -- Every new table: RLS on, no policies, nothing granted to anon/authenticated.
  FOREACH t IN ARRAY ARRAY['detection_sources', 'ingestion_runs', 'source_records', 'ingestion_failures', 'projects', 'project_links',
                           'awards', 'external_identities', 'detection_candidates', 'candidate_evidence', 'candidate_subjects', 'candidate_events'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = t) THEN RAISE EXCEPTION '% has RLS off', t; END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t) THEN RAISE EXCEPTION '% has a policy', t; END IF;
    IF has_table_privilege('anon', t, 'SELECT') OR has_table_privilege('authenticated', t, 'SELECT')
       OR has_table_privilege('anon', t, 'INSERT') OR has_table_privilege('authenticated', t, 'UPDATE') THEN
      RAISE EXCEPTION '% is readable or writable by a public role', t;
    END IF;
  END LOOP;
  RAISE NOTICE '12 tables: RLS on, no policies, no access for anon or authenticated';

  -- Matching functions: server only.
  IF has_function_privilege('anon', 'public.detection_match_people(text, int)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.detection_match_organizations(text, text[], int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'matching functions callable by a public role';
  END IF;
  RAISE NOTICE 'matching functions: service role only';

  -- Seed source, off by default, seeded once.
  SELECT id INTO src FROM detection_sources WHERE slug = 'esr-iphd' AND NOT enabled;
  IF src IS NULL THEN RAISE EXCEPTION 'i-PhD source missing or enabled'; END IF;
  SELECT count(*) INTO n FROM detection_sources;
  IF n <> 1 THEN RAISE EXCEPTION 'expected 1 source after two runs, got %', n; END IF;
  RAISE NOTICE 'i-PhD source seeded once, switched off';

  -- Accent-insensitive matching returns ranked suggestions.
  SELECT count(*) INTO n FROM detection_match_people('Helene Durand');
  IF n < 2 THEN RAISE EXCEPTION 'expected both Durand homonyms, got %', n; END IF;
  IF (SELECT slug FROM detection_match_people('Helene Durand') LIMIT 1) <> 'helene-durand' THEN RAISE EXCEPTION 'exact name not ranked first'; END IF;
  IF EXISTS (SELECT 1 FROM detection_match_people('Helene Durand') WHERE slug = 'marc-lefebvre') THEN RAISE EXCEPTION 'unrelated person matched'; END IF;
  IF (SELECT slug FROM detection_match_organizations('Institut des systemes intelligents et de robotique (ISIR)', ARRAY['research_lab', 'university']) LIMIT 1) <> 'isir' THEN
    RAISE EXCEPTION 'lab not matched';
  END IF;
  IF EXISTS (SELECT 1 FROM detection_match_organizations('Robotique Intelligente', ARRAY['research_lab']) WHERE slug = 'robotique-intelligente') THEN
    RAISE EXCEPTION 'type filter ignored';
  END IF;
  RAISE NOTICE 'name matching: accent-insensitive, homonyms both proposed, type filter works';

  -- Re-reading the same content is a no-op; changed content keeps both versions.
  INSERT INTO source_records (source_id, external_id, content_hash, payload) VALUES (src, 'x1', 'h1', '{}') RETURNING id INTO rec;
  INSERT INTO source_records (source_id, external_id, content_hash, payload) VALUES (src, 'x1', 'h1', '{}') ON CONFLICT DO NOTHING;
  INSERT INTO source_records (source_id, external_id, content_hash, payload) VALUES (src, 'x1', 'h2', '{}');
  SELECT count(*) INTO n FROM source_records WHERE external_id = 'x1';
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 versions, got %', n; END IF;
  RAISE NOTICE 'source records: same content once, a change adds a version';

  -- One candidate per source item; states are constrained.
  INSERT INTO projects (name, slug) VALUES ('Demo', 'demo') RETURNING id INTO proj;
  INSERT INTO detection_candidates (kind, source_key, title, project_id) VALUES ('project', 'k1', 'Demo', proj) RETURNING id INTO cand;
  BEGIN
    INSERT INTO detection_candidates (kind, source_key, title) VALUES ('project', 'k1', 'Dup');
    RAISE EXCEPTION 'duplicate source_key accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE detection_candidates SET state = 'published' WHERE id = cand;
    RAISE EXCEPTION 'unknown state accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO detection_candidates (kind, source_key, title, ai_relevance) VALUES ('project', 'k2', 'x', 1.5);
    RAISE EXCEPTION 'score above 1 accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'candidates: one per source item, states and scores constrained';

  -- A project link points at exactly one thing.
  BEGIN
    INSERT INTO project_links (project_id) VALUES (proj);
    RAISE EXCEPTION 'link with no target accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO project_links (project_id, person_id, organization_id)
    VALUES (proj, '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a');
    RAISE EXCEPTION 'link with two targets accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'project links: exactly one target';

  -- Awards can't be typed as an equity round.
  BEGIN
    INSERT INTO awards (award_type, title) VALUES ('seed', 'x');
    RAISE EXCEPTION 'equity-like award type accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'awards: only competition, prize, grant, label, fellowship, other';

  -- Evidence and subjects go with their candidate; deleting a candidate keeps records.
  INSERT INTO candidate_evidence (candidate_id, source_record_id, evidence_family) VALUES (cand, rec, 'f1');
  INSERT INTO candidate_subjects (candidate_id, role, proposed_name) VALUES (cand, 'person', 'Hélène Durand');
  INSERT INTO candidate_events (candidate_id, action) VALUES (cand, 'created');
  DELETE FROM detection_candidates WHERE id = cand;
  IF EXISTS (SELECT 1 FROM candidate_evidence WHERE candidate_id = cand) OR EXISTS (SELECT 1 FROM candidate_subjects WHERE candidate_id = cand) THEN
    RAISE EXCEPTION 'evidence or subjects left behind';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM source_records WHERE id = rec) THEN RAISE EXCEPTION 'source record deleted with candidate'; END IF;
  RAISE NOTICE 'deleting a candidate removes its file, keeps the source evidence';

  -- Public tables untouched by the migration.
  SELECT count(*) INTO n FROM people;
  IF n <> 3 THEN RAISE EXCEPTION 'people changed'; END IF;
  SELECT count(*) INTO n FROM organizations;
  IF n <> 2 THEN RAISE EXCEPTION 'organizations changed'; END IF;
  RAISE NOTICE 'public tables unchanged';
END $$;
