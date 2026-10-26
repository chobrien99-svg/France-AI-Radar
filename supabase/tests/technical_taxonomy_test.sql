-- Assertions for the technical taxonomy migrations (20261025, 20261026).
-- Run by run_taxonomy_tests.sh after applying the migration twice.
\set ON_ERROR_STOP on

CREATE FUNCTION pg_temp.expect(ok BOOLEAN, what TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', what; END IF;
  RAISE NOTICE 'ok: %', what;
END $$;

-- Runs a statement that must fail with the given SQLSTATE.
CREATE FUNCTION pg_temp.expect_error(stmt TEXT, code TEXT, what TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code THEN RAISE NOTICE 'ok: %', what; RETURN; END IF;
    RAISE EXCEPTION 'FAIL: % (got % %)', what, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL: % (statement succeeded)', what;
END $$;

-- Seeds: exact counts prove the second run added nothing.
SELECT pg_temp.expect((SELECT count(*) FROM technical_layers) = 12, '12 primary layers seeded');
SELECT pg_temp.expect((SELECT count(*) FROM technical_terms WHERE facet = 'specialization') = 79, '79 specializations seeded');
SELECT pg_temp.expect((SELECT count(*) FROM technical_terms WHERE facet = 'method') = 20, '20 methods seeded');
SELECT pg_temp.expect((SELECT count(*) FROM technical_terms WHERE facet = 'modality') = 19, '19 modalities seeded');
SELECT pg_temp.expect((SELECT count(*) FROM technical_terms WHERE facet = 'domain') = 17, '17 domains seeded');
SELECT pg_temp.expect((SELECT count(*) FROM technical_term_aliases) = 74, '74 aliases seeded (none lost to a missing slug)');
SELECT pg_temp.expect((SELECT count(*) FROM technical_terms WHERE parent_term_id IS NOT NULL) = 7, '7 parent links');
SELECT pg_temp.expect(
  (SELECT p.slug FROM technical_terms c JOIN technical_terms p ON p.id = c.parent_term_id WHERE c.slug = 'autonomous_scientific_agents') = 'autonomous_research_agents',
  'scientific agents sit under research agents');
SELECT pg_temp.expect(NOT EXISTS (
  SELECT 1 FROM technical_term_aliases a JOIN technical_terms t ON lower(t.label) = a.normalized_alias
), 'no alias duplicates a term label');
SELECT pg_temp.expect((
  SELECT count(*) FROM technical_terms WHERE label IN ('Explainable AI', 'Causal AI', 'Predictive Modeling', 'Computational Biology',
    'Retrieval-Augmented Generation', 'Physics-Informed Machine Learning')
) = 10, 'cross-listed handoff choices present (4 labels in two lists, 2 renamed in methods)');
SELECT pg_temp.expect((SELECT count(*) FROM technical_terms WHERE slug IN ('dynamic_routing', 'model_evaluation', 'multi_omics_data', 'ai_for_science', 'model_development')) = 5,
  'choices from the handoff examples seeded');

-- Backfill: only the AI Radar 'application' startup, as inferred, as primary.
SELECT pg_temp.expect((SELECT count(*) FROM organization_technical_layers) = 1, 'backfill created exactly one link');
SELECT pg_temp.expect(EXISTS (
  SELECT 1 FROM organization_technical_layers x JOIN technical_layers l ON l.id = x.layer_id
  WHERE x.organization_id = '00000000-0000-0000-0000-00000000000a'
    AND l.slug = 'ai_native_applications' AND x.is_primary AND x.evidence_status = 'inferred'
), 'Radar app startup backfilled as inferred AI-Native Applications');
SELECT pg_temp.expect(NOT EXISTS (
  SELECT 1 FROM organization_technical_layers
  WHERE organization_id IN ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d')
), 'non-Radar, infrastructure and unclassified companies left unset');
SELECT pg_temp.expect((SELECT count(*) FROM organizations WHERE technology_layer IS NOT NULL) = 3, 'legacy technology_layer untouched');

-- Constraints
SELECT pg_temp.expect_error($$
  INSERT INTO organization_technical_layers (organization_id, layer_id, is_primary)
  SELECT '00000000-0000-0000-0000-00000000000a', id, true FROM technical_layers WHERE slug = 'foundation_models'
$$, '23505', 'second primary layer rejected');
INSERT INTO organization_technical_layers (organization_id, layer_id, is_primary)
  SELECT '00000000-0000-0000-0000-00000000000a', id, false FROM technical_layers WHERE slug = 'foundation_models';
SELECT pg_temp.expect(true, 'secondary layer alongside a primary accepted');
SELECT pg_temp.expect_error($$
  INSERT INTO organization_technical_layers (organization_id, layer_id)
  SELECT '00000000-0000-0000-0000-00000000000a', id FROM technical_layers WHERE slug = 'foundation_models'
$$, '23505', 'duplicate layer link rejected');

INSERT INTO organization_technical_terms (organization_id, term_id, relationship_kind)
  SELECT '00000000-0000-0000-0000-00000000000a', id, 'develops' FROM technical_terms WHERE slug = 'model_routing';
INSERT INTO organization_technical_terms (organization_id, term_id, relationship_kind)
  SELECT '00000000-0000-0000-0000-00000000000a', id, 'researches' FROM technical_terms WHERE slug = 'model_routing';
SELECT pg_temp.expect(true, 'same term with a different relationship accepted');
SELECT pg_temp.expect_error($$
  INSERT INTO organization_technical_terms (organization_id, term_id, relationship_kind)
  SELECT '00000000-0000-0000-0000-00000000000a', id, 'develops' FROM technical_terms WHERE slug = 'model_routing'
$$, '23505', 'duplicate term link rejected');
SELECT pg_temp.expect_error($$
  INSERT INTO organization_technical_terms (organization_id, term_id, relationship_kind)
  SELECT '00000000-0000-0000-0000-00000000000a', id, 'sells' FROM technical_terms WHERE slug = 'edge_ai'
$$, '23514', 'unknown relationship kind rejected');
SELECT pg_temp.expect_error($$
  INSERT INTO organization_technical_terms (organization_id, term_id, evidence_status)
  SELECT '00000000-0000-0000-0000-00000000000a', id, 'rumoured' FROM technical_terms WHERE slug = 'edge_ai'
$$, '23514', 'unknown evidence status rejected');
SELECT pg_temp.expect_error($$
  INSERT INTO technical_terms (slug, label, facet) VALUES ('x', 'X', 'buzzword')
$$, '23514', 'unknown facet rejected');
SELECT pg_temp.expect_error($$
  INSERT INTO technical_term_aliases (term_id, alias) SELECT id, '  rag ' FROM technical_terms WHERE slug = 'edge_ai'
$$, '23505', 'alias collision detected after normalization');
SELECT pg_temp.expect_error($$
  INSERT INTO organization_technology_claims (organization_id, claim) VALUES ('00000000-0000-0000-0000-00000000000a', 'magic')
$$, '23514', 'unknown claim rejected');
SELECT pg_temp.expect_error($$
  INSERT INTO organization_profiles (organization_id, technology_positioning) VALUES ('00000000-0000-0000-0000-00000000000a', 'unicorn')
$$, '23514', 'unknown positioning rejected');
SELECT pg_temp.expect_error($$
  INSERT INTO organization_profiles (organization_id, technology_maturity) VALUES ('00000000-0000-0000-0000-00000000000a', 'ga')
$$, '23514', 'unknown maturity rejected');
INSERT INTO organization_profiles (organization_id, ai_product_role, technology_positioning, technology_maturity)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'infrastructure', 'enabling_infrastructure', 'beta');
SELECT pg_temp.expect(true, 'valid profile values accepted');

-- Foreign keys
SELECT pg_temp.expect_error($$
  INSERT INTO organization_technical_terms (organization_id, term_id)
  SELECT gen_random_uuid(), id FROM technical_terms WHERE slug = 'edge_ai'
$$, '23503', 'link to a missing organization rejected');
SELECT pg_temp.expect_error($$
  DELETE FROM technical_terms WHERE slug = 'model_routing'
$$, '23503', 'a term in use cannot be deleted (retire it instead)');

-- updated_at trigger
UPDATE organization_technical_terms SET updated_at = '2000-01-01', is_core = true WHERE relationship_kind = 'researches';
SELECT pg_temp.expect((SELECT updated_at > '2001-01-01' FROM organization_technical_terms WHERE relationship_kind = 'researches'), 'updated_at refreshed on update');

-- Row-level security
SET ROLE anon;
SELECT pg_temp.expect((SELECT count(*) FROM technical_layers) = 12, 'anon can read layers');
SELECT pg_temp.expect((SELECT count(*) FROM organization_technical_terms) = 2, 'anon can read classifications');
SELECT pg_temp.expect_error($$
  INSERT INTO technical_layers (slug, label) VALUES ('anon_layer', 'Anon')
$$, '42501', 'anon cannot add layers');
DELETE FROM organization_technical_terms; -- RLS filters every row out
RESET ROLE;
SELECT pg_temp.expect((SELECT count(*) FROM organization_technical_terms) = 2, 'anon cannot delete classifications');

SET ROLE authenticated;
SET test.uid = '00000000-0000-0000-0000-0000000000ee';
SELECT pg_temp.expect_error($$
  INSERT INTO technical_terms (slug, label, facet) VALUES ('member_term', 'Member', 'method')
$$, '42501', 'non-admin member cannot add terms');
SET test.uid = '00000000-0000-0000-0000-0000000000ad';
INSERT INTO technical_terms (slug, label, facet) VALUES ('admin_term', 'Admin Term', 'method');
SELECT pg_temp.expect(true, 'admin can add terms');
UPDATE technical_terms SET is_active = false WHERE slug = 'admin_term';
SELECT pg_temp.expect((SELECT NOT is_active FROM technical_terms WHERE slug = 'admin_term'), 'admin can retire terms');
RESET test.uid;
RESET ROLE;
DELETE FROM technical_terms WHERE slug = 'admin_term';
