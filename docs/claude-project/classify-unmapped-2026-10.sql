-- Technical classification for the companies whose legacy technology_layer
-- did not map to a primary layer (see docs/technical-taxonomy.md).
-- Every link is marked "inferred" and was drawn from the Radar's own
-- description fields. Safe to run more than once: existing links are kept.
-- Deliberately left out: Neutrogen Technologies, Phyntec (not AI-led) and the
-- non-Radar companies that are not AI-native (Agryco, Alan, Crosscall,
-- HR Path, Locala, ManoMano, Yubo).

BEGIN;

WITH layers(org_slug, layer_slug, is_primary) AS (VALUES
  ('aurels',     'ai_security_safety_governance',      true),
  ('aurels',     'agent_infrastructure_orchestration', false),
  ('axone',      'compute_hardware',                   true),
  ('axone',      'inference_optimization',             false),
  ('jemba',      'ai_native_applications',             true),
  ('katrix-ai',  'embodied_ai_robotics',               true),
  ('katrix-ai',  'compute_hardware',                   false),
  ('signeva',    'knowledge_reasoning_infrastructure', true),
  ('signeva',    'embodied_ai_robotics',               false),
  ('mistral-ai', 'foundation_models',                  true),
  ('sekoia',     'ai_native_applications',             true)
)
INSERT INTO organization_technical_layers (organization_id, layer_id, is_primary, evidence_status, source_note)
SELECT o.id, l.id, x.is_primary, 'inferred', 'Inferred from Radar description (Oct 2026 backfill)'
FROM layers x
JOIN organizations o ON o.slug = x.org_slug
JOIN technical_layers l ON l.slug = x.layer_slug
ON CONFLICT DO NOTHING;

WITH terms(org_slug, term_slug, kind, is_core) AS (VALUES
  -- Aurels: security layer between an agent's decision and its execution
  ('aurels',     'agent_security',               'develops', true),
  ('aurels',     'ai_agents',                    'uses',     false),
  ('aurels',     'cybersecurity',                'develops', false),
  ('aurels',     'financial_services',           'develops', false),
  -- Axone: neuromorphic chips for edge inference
  ('axone',      'edge_ai',                      'develops', true),
  ('axone',      'inference_optimization',       'develops', false),
  ('axone',      'sensor_iot_data',              'uses',     false),
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
  ('signeva',    'robotics',                     'develops', false),
  -- Mistral AI: general-purpose generative models
  ('mistral-ai', 'large_language_models',        'develops', true),
  ('mistral-ai', 'multimodal_foundation_models', 'develops', false),
  ('mistral-ai', 'small_language_models',        'develops', false),
  ('mistral-ai', 'generative_modeling',          'uses',     false),
  ('mistral-ai', 'text_data',                    'uses',     false),
  -- Sekoia: AI-assisted security operations platform
  ('sekoia',     'cybersecurity',                'develops', true),
  ('sekoia',     'ai_agents',                    'uses',     false)
)
INSERT INTO organization_technical_terms (organization_id, term_id, relationship_kind, is_core, evidence_status, source_note)
SELECT o.id, t.id, x.kind, x.is_core, 'inferred', 'Inferred from Radar description (Oct 2026 backfill)'
FROM terms x
JOIN organizations o ON o.slug = x.org_slug
JOIN technical_terms t ON t.slug = x.term_slug
ON CONFLICT DO NOTHING;

-- Only fills empty fields, so nothing already entered by hand is overwritten.
WITH p(org_slug, role, positioning, maturity) AS (VALUES
  ('aurels',     'infrastructure', 'enabling_infrastructure',       NULL),
  ('axone',      'infrastructure', 'frontier_technology_developer', NULL),
  ('jemba',      'platform',       'vertical_ai_application',       NULL),
  ('katrix-ai',  'infrastructure', 'enabling_infrastructure',       NULL),
  ('signeva',    'infrastructure', 'frontier_technology_developer', 'research'),
  ('mistral-ai', 'platform',       'frontier_technology_developer', 'commercial'),
  ('sekoia',     'application',    'ai_enabled_software',           'commercial')
)
UPDATE organization_profiles op SET
  ai_product_role        = COALESCE(op.ai_product_role, p.role),
  technology_positioning = COALESCE(op.technology_positioning, p.positioning),
  technology_maturity    = COALESCE(op.technology_maturity, p.maturity)
FROM p JOIN organizations o ON o.slug = p.org_slug
WHERE op.organization_id = o.id;

COMMIT;

-- Check: should list 7 companies, each with one primary layer.
SELECT o.name, l.label AS primary_layer, op.ai_product_role, op.technology_positioning, op.technology_maturity,
  (SELECT count(*) FROM organization_technical_terms tt WHERE tt.organization_id = o.id) AS terms
FROM organizations o
JOIN organization_technical_layers ol ON ol.organization_id = o.id AND ol.is_primary
JOIN technical_layers l ON l.id = ol.layer_id
LEFT JOIN organization_profiles op ON op.organization_id = o.id
WHERE o.slug IN ('aurels','axone','jemba','katrix-ai','signeva','mistral-ai','sekoia')
ORDER BY o.name;
