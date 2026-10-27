-- Technical classification for the companies whose legacy technology_layer
-- did not map to a primary layer (see docs/technical-taxonomy.md).
-- Every link is marked "inferred" and was drawn from the Radar's own
-- description fields. Safe to run more than once: existing links are kept.
-- Only AI Radar companies are included. Deliberately left out: Aurels (draft
-- still being written), Axone (likely a test record), Neutrogen Technologies
-- and Phyntec (not AI-led), and every company not on the Radar (Agryco, Alan,
-- Crosscall, HR Path, Locala, ManoMano, Mistral AI, Sekoia, Yubo).

BEGIN;

WITH layers(org_slug, layer_slug, is_primary) AS (VALUES
  ('jemba',      'ai_native_applications',             true),
  ('katrix-ai',  'embodied_ai_robotics',               true),
  ('katrix-ai',  'compute_hardware',                   false),
  ('signeva',    'knowledge_reasoning_infrastructure', true),
  ('signeva',    'embodied_ai_robotics',               false)
)
INSERT INTO organization_technical_layers (organization_id, layer_id, is_primary, evidence_status, source_note)
SELECT o.id, l.id, x.is_primary, 'inferred', 'Inferred from Radar description (Oct 2026 backfill)'
FROM layers x
JOIN organizations o ON o.slug = x.org_slug
JOIN technical_layers l ON l.slug = x.layer_slug
ON CONFLICT DO NOTHING;

WITH terms(org_slug, term_slug, kind, is_core) AS (VALUES
  -- Jemba: industrial ML on existing factory data
  ('jemba',      'predictive_maintenance',       'develops', true),
  ('jemba',      'predictive_modeling',          'uses',     false),
  ('jemba',      'time_series_data',             'uses',     false),
  ('jemba',      'sensor_iot_data',              'uses',     false),
  ('jemba',      'industrial_operations',        'develops', false),
  -- Katrix.AI: multi-sensor perception SDK and edge module
  ('katrix-ai',  'autonomous_vehicles_drones',   'develops', true),
  ('katrix-ai',  'edge_ai',                      'develops', false),
  ('katrix-ai',  'multimodal_learning',          'uses',     false),
  ('katrix-ai',  'sensor_iot_data',              'uses',     false),
  ('katrix-ai',  'image_data',                   'uses',     false),
  ('katrix-ai',  'robotics',                     'develops', false),
  -- Signéva: cognitive architecture for autonomous systems
  ('signeva',    'hybrid_symbolic_reasoning',    'develops', true),
  ('signeva',    'agent_memory_context',         'develops', false),
  ('signeva',    'embodied_agents',              'develops', false),
  ('signeva',    'symbolic_reasoning',           'uses',     false),
  ('signeva',    'robotics',                     'develops', false)
)
INSERT INTO organization_technical_terms (organization_id, term_id, relationship_kind, is_core, evidence_status, source_note)
SELECT o.id, t.id, x.kind, x.is_core, 'inferred', 'Inferred from Radar description (Oct 2026 backfill)'
FROM terms x
JOIN organizations o ON o.slug = x.org_slug
JOIN technical_terms t ON t.slug = x.term_slug
ON CONFLICT DO NOTHING;

-- Only fills empty fields, so nothing already entered by hand is overwritten.
WITH p(org_slug, role, positioning, maturity) AS (VALUES
  ('jemba',      'platform',       'vertical_ai_application',       NULL),
  ('katrix-ai',  'infrastructure', 'enabling_infrastructure',       NULL),
  ('signeva',    'infrastructure', 'frontier_technology_developer', 'research')
)
UPDATE organization_profiles op SET
  ai_product_role        = COALESCE(op.ai_product_role, p.role),
  technology_positioning = COALESCE(op.technology_positioning, p.positioning),
  technology_maturity    = COALESCE(op.technology_maturity, p.maturity)
FROM p JOIN organizations o ON o.slug = p.org_slug
WHERE op.organization_id = o.id;

COMMIT;

-- Check: should list 3 companies, each with one primary layer.
SELECT o.name, l.label AS primary_layer, op.ai_product_role, op.technology_positioning, op.technology_maturity,
  (SELECT count(*) FROM organization_technical_terms tt WHERE tt.organization_id = o.id) AS terms
FROM organizations o
JOIN organization_technical_layers ol ON ol.organization_id = o.id AND ol.is_primary
JOIN technical_layers l ON l.id = ol.layer_id
LEFT JOIN organization_profiles op ON op.organization_id = o.id
WHERE o.slug IN ('jemba','katrix-ai','signeva')
ORDER BY o.name;
