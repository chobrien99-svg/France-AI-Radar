-- Technical taxonomy: where a startup sits in the AI stack, what it builds,
-- which methods it uses, which data it handles and which domains it serves.
-- Spec and canonical facet mapping: docs/technical-taxonomy.md
--
-- Additive only: no existing table or column is renamed, changed or dropped.
-- organizations.technology_layer is left intact for the transition.
-- Safe to run twice: tables/columns/indexes use IF NOT EXISTS, policies are
-- recreated, seeds and the backfill skip rows that already exist.
-- Rollback: supabase/rollbacks/20261025_technical_taxonomy.sql

-- ------------------------------------------------------------------
-- 0. Compatibility check: stop if a table with one of our names already
--    exists with a different shape (IF NOT EXISTS would silently keep it).
-- ------------------------------------------------------------------
DO $$
DECLARE
  expected JSONB := '{
    "technical_layers": ["id", "slug", "label", "description", "display_order", "is_active"],
    "technical_terms": ["id", "slug", "label", "definition", "facet", "family", "parent_term_id", "is_active", "display_order"],
    "technical_term_aliases": ["id", "term_id", "alias", "normalized_alias"],
    "organization_technical_layers": ["id", "organization_id", "layer_id", "is_primary", "evidence_status", "source_url", "source_note"],
    "organization_technical_terms": ["id", "organization_id", "term_id", "relationship_kind", "is_core", "evidence_status", "source_url", "source_note"],
    "organization_technology_claims": ["id", "organization_id", "claim", "evidence_status", "source_url", "source_note"]
  }';
  t TEXT;
  c TEXT;
BEGIN
  FOR t IN SELECT jsonb_object_keys(expected) LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      FOR c IN SELECT jsonb_array_elements_text(expected -> t) LOOP
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = t AND column_name = c
        ) THEN
          RAISE EXCEPTION 'public.% already exists without column %: inspect it before running this migration', t, c;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------
-- 1. Controlled vocabularies
-- ------------------------------------------------------------------

-- The 12 primary layers of the AI stack. Store by slug; labels may evolve.
CREATE TABLE IF NOT EXISTS technical_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Specializations, methods, modalities and domains. Every term has exactly
-- one canonical facet; other names for it live in technical_term_aliases.
-- Retire a term with is_active = false rather than deleting it.
CREATE TABLE IF NOT EXISTS technical_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  definition TEXT,
  facet TEXT NOT NULL CHECK (facet IN ('specialization', 'method', 'modality', 'domain')),
  family TEXT,
  parent_term_id UUID REFERENCES technical_terms(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_technical_terms_facet ON technical_terms (facet, display_order);
CREATE INDEX IF NOT EXISTS idx_technical_terms_parent ON technical_terms (parent_term_id);

-- Synonyms and abbreviations used by search ("RAG", "LLM", "Agentic AI").
CREATE TABLE IF NOT EXISTS technical_term_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id UUID NOT NULL REFERENCES technical_terms(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT GENERATED ALWAYS AS (lower(regexp_replace(btrim(alias), '\s+', ' ', 'g'))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS technical_term_aliases_normalized_key ON technical_term_aliases (normalized_alias);
CREATE INDEX IF NOT EXISTS idx_technical_term_aliases_term ON technical_term_aliases (term_id);

-- ------------------------------------------------------------------
-- 2. Organization classifications. Every link carries its evidence:
--    verified | reported | inferred | unverified (default).
-- ------------------------------------------------------------------

-- Zero or one primary layer (unknown stays unset) plus any secondary layers.
CREATE TABLE IF NOT EXISTS organization_technical_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  layer_id UUID NOT NULL REFERENCES technical_layers(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  evidence_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (evidence_status IN ('verified', 'reported', 'inferred', 'unverified')),
  source_url TEXT,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, layer_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_technical_layer_per_org
  ON organization_technical_layers (organization_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_org_technical_layers_layer ON organization_technical_layers (layer_id);

-- relationship_kind separates building a technology from consuming it:
-- a startup that calls a hosted LLM "uses" LLMs, it does not "develop" them.
CREATE TABLE IF NOT EXISTS organization_technical_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES technical_terms(id) ON DELETE RESTRICT,
  relationship_kind TEXT NOT NULL DEFAULT 'develops'
    CHECK (relationship_kind IN ('develops', 'uses', 'researches')),
  is_core BOOLEAN NOT NULL DEFAULT false,
  evidence_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (evidence_status IN ('verified', 'reported', 'inferred', 'unverified')),
  source_url TEXT,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, term_id, relationship_kind)
);
CREATE INDEX IF NOT EXISTS idx_org_technical_terms_term ON organization_technical_terms (term_id);

-- Proprietary-technology claims. These are claims needing evidence, not facts.
CREATE TABLE IF NOT EXISTS organization_technology_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claim TEXT NOT NULL CHECK (claim IN (
    'own_model', 'proprietary_dataset', 'proprietary_algorithm', 'patented_technology',
    'proprietary_hardware', 'open_source_core', 'third_party_models_only'
  )),
  evidence_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (evidence_status IN ('verified', 'reported', 'inferred', 'unverified')),
  source_url TEXT,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, claim)
);

-- Single-select technology profile fields live with the other narrative
-- fields in organization_profiles (one row per organization).
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS ai_product_role TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS technology_positioning TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS technology_maturity TEXT;
ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS technology_differentiation TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_profiles_ai_product_role_check') THEN
    ALTER TABLE organization_profiles ADD CONSTRAINT organization_profiles_ai_product_role_check
      CHECK (ai_product_role IN ('infrastructure', 'platform', 'application'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_profiles_technology_positioning_check') THEN
    ALTER TABLE organization_profiles ADD CONSTRAINT organization_profiles_technology_positioning_check
      CHECK (technology_positioning IN (
        'frontier_technology_developer', 'enabling_infrastructure', 'ai_native_platform',
        'vertical_ai_application', 'ai_enabled_software', 'research_commercialization'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_profiles_technology_maturity_check') THEN
    ALTER TABLE organization_profiles ADD CONSTRAINT organization_profiles_technology_maturity_check
      CHECK (technology_maturity IN ('research', 'prototype', 'beta', 'commercial'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_profiles_technology_differentiation_check') THEN
    ALTER TABLE organization_profiles ADD CONSTRAINT organization_profiles_technology_differentiation_check
      CHECK (char_length(technology_differentiation) <= 1000);
  END IF;
END $$;

COMMENT ON COLUMN organization_profiles.ai_product_role IS 'infrastructure | platform | application; NULL = unknown';
COMMENT ON COLUMN organization_profiles.technology_positioning IS 'Investor-level characterization; NULL = unknown';
COMMENT ON COLUMN organization_profiles.technology_maturity IS 'research | prototype | beta | commercial; NULL = unknown';
COMMENT ON COLUMN organization_profiles.technology_differentiation IS 'Short editorial note on what is technically distinctive';

-- ------------------------------------------------------------------
-- 3. updated_at triggers, row-level security and policies
--    (same model as sectors / organization_sectors: public read,
--    admin write; the app itself writes with the service role)
-- ------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  admin_check TEXT := '(auth.uid() IN (SELECT profiles.id FROM profiles WHERE profiles.is_admin = true))';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'technical_layers', 'technical_terms', 'technical_term_aliases',
    'organization_technical_layers', 'organization_technical_terms', 'organization_technology_claims'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "Public read access" ON %I', t);
    EXECUTE format('CREATE POLICY "Public read access" ON %I FOR SELECT USING (true)', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Admins can insert ' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK %s', 'Admins can insert ' || t, t, admin_check);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Admins can update ' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING %s', 'Admins can update ' || t, t, admin_check);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Admins can delete ' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING %s', 'Admins can delete ' || t, t, admin_check);

    IF t <> 'technical_term_aliases' THEN
      EXECUTE format('CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------
-- 4. Seed: primary layers
-- ------------------------------------------------------------------
INSERT INTO technical_layers (slug, label, description, display_order) VALUES
  ('compute_hardware', 'Compute & Hardware', 'AI chips, accelerators, inference and specialized hardware', 10),
  ('cloud_compute_infrastructure', 'Cloud & Compute Infrastructure', 'GPU clouds, clusters, distributed compute, cluster management', 20),
  ('data_infrastructure', 'Data Infrastructure', 'Data pipelines, training datasets, labeling, synthetic data', 30),
  ('foundation_models', 'Foundation Models', 'General-purpose and specialized pretrained models', 40),
  ('model_development_training', 'Model Development & Training', 'Training frameworks, fine-tuning, post-training, distillation', 50),
  ('inference_optimization', 'Inference & Optimization', 'Model serving, routing, compression, latency and cost optimization', 60),
  ('agent_infrastructure_orchestration', 'Agent Infrastructure & Orchestration', 'Agent runtimes, orchestration, tool use, memory, coordination', 70),
  ('ai_development_operations', 'AI Development & Operations', 'LLMOps, evaluation, observability, testing, deployment', 80),
  ('ai_security_safety_governance', 'AI Security, Safety & Governance', 'Model security, guardrails, policy, compliance, agent permissions', 90),
  ('knowledge_reasoning_infrastructure', 'Knowledge & Reasoning Infrastructure', 'Knowledge graphs, retrieval, semantic systems, reasoning engines', 100),
  ('ai_native_applications', 'AI-Native Applications', 'Products that use AI to deliver a customer-facing workflow', 110),
  ('embodied_ai_robotics', 'Embodied AI & Robotics', 'Robotics foundation models, autonomy, physical-world intelligence', 120)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------------
-- 5. Seed: technical terms (slug, label, facet, family, order, definition)
-- ------------------------------------------------------------------
INSERT INTO technical_terms (slug, label, facet, family, display_order, definition) VALUES
  -- Specializations · Foundation models and architectures
  ('large_language_models', 'Large Language Models', 'specialization', 'foundation_models', 1010, 'General-purpose and domain-specific language models'),
  ('small_language_models', 'Small Language Models', 'specialization', 'foundation_models', 1020, 'Compact, efficient, edge-deployable models'),
  ('multimodal_foundation_models', 'Multimodal Foundation Models', 'specialization', 'foundation_models', 1030, 'Models combining text, image, audio, video or structured data'),
  ('vision_language_models', 'Vision-Language Models', 'specialization', 'foundation_models', 1040, 'Visual understanding and language reasoning'),
  ('speech_audio_models', 'Speech and Audio Models', 'specialization', 'foundation_models', 1050, 'ASR, TTS, speech-to-speech, audio understanding'),
  ('video_generation_understanding', 'Video Generation and Understanding', 'specialization', 'foundation_models', 1060, 'Video foundation models, temporal reasoning'),
  ('world_models', 'World Models', 'specialization', 'foundation_models', 1070, 'Predictive models of physical or simulated environments'),
  ('reasoning_models', 'Reasoning Models', 'specialization', 'foundation_models', 1080, 'Deliberative, mathematical and symbolic reasoning models'),
  ('scientific_foundation_models', 'Scientific Foundation Models', 'specialization', 'foundation_models', 1090, 'Models trained on scientific data or physical systems'),
  ('biological_foundation_models', 'Biological Foundation Models', 'specialization', 'foundation_models', 1100, 'Protein, genomic, cellular, molecular and clinical models'),
  ('geospatial_foundation_models', 'Geospatial Foundation Models', 'specialization', 'foundation_models', 1110, 'Earth observation, satellite and spatial intelligence'),
  -- Specializations · Agents and agentic systems
  ('ai_agents', 'AI Agents', 'specialization', 'agents', 2010, 'Systems that execute tasks using models and tools'),
  ('agent_orchestration', 'Agent Orchestration', 'specialization', 'agents', 2020, 'Coordinating agent execution, tools, workflows and state'),
  ('multi_agent_systems', 'Multi-Agent Systems', 'specialization', 'agents', 2030, 'Multiple agents cooperating or competing'),
  ('autonomous_research_agents', 'Autonomous Research Agents', 'specialization', 'agents', 2040, 'Agents conducting research, experiments or investigations'),
  ('autonomous_scientific_agents', 'Autonomous Scientific Agents', 'specialization', 'agents', 2050, 'Agents designing and executing scientific workflows'),
  ('coding_agents', 'Coding Agents', 'specialization', 'agents', 2060, 'Software development, testing, debugging and maintenance'),
  ('computer_use_agents', 'Computer-Use Agents', 'specialization', 'agents', 2070, 'Agents interacting with applications and graphical interfaces'),
  ('browser_web_agents', 'Browser and Web Agents', 'specialization', 'agents', 2080, 'Autonomous web navigation and online workflows'),
  ('agent_memory_context', 'Agent Memory and Context', 'specialization', 'agents', 2090, 'Persistent memory, context management, retrieval for agents'),
  ('agent_tool_infrastructure', 'Agent Tool Infrastructure', 'specialization', 'agents', 2100, 'Tool integration, MCP, APIs, function calling'),
  ('agent_evaluation', 'Agent Evaluation', 'specialization', 'agents', 2110, 'Testing agent reliability, outcomes and failure modes'),
  ('agent_security', 'Agent Security', 'specialization', 'agents', 2120, 'Agent identity, permissions, isolation, monitoring'),
  ('agent_marketplaces_platforms', 'Agent Marketplaces and Platforms', 'specialization', 'agents', 2130, 'Distribution, hosting and management of agents'),
  ('vertical_ai_agents', 'Vertical AI Agents', 'specialization', 'agents', 2140, 'Agents purpose-built for legal, finance, healthcare and other industries'),
  -- Specializations · Data, knowledge and reasoning
  ('knowledge_graphs', 'Knowledge Graphs', 'specialization', 'data_knowledge_reasoning', 3010, 'Structured entities, relationships, graph-based intelligence'),
  ('retrieval_augmented_generation', 'Retrieval-Augmented Generation', 'specialization', 'data_knowledge_reasoning', 3020, 'RAG pipelines and retrieval systems'),
  ('vector_databases_search', 'Vector Databases and Search', 'specialization', 'data_knowledge_reasoning', 3030, 'Embeddings, similarity search, semantic retrieval'),
  ('synthetic_data', 'Synthetic Data', 'specialization', 'data_knowledge_reasoning', 3040, 'Generation of artificial training or testing datasets'),
  ('data_annotation_enrichment', 'Data Annotation and Enrichment', 'specialization', 'data_knowledge_reasoning', 3050, 'Labeling, structuring and enhancing datasets'),
  ('data_provenance', 'Data Provenance', 'specialization', 'data_knowledge_reasoning', 3060, 'Lineage, traceability, licensing and source verification'),
  -- Specializations · Infrastructure and optimization
  ('gpu_infrastructure', 'GPU Infrastructure', 'specialization', 'infrastructure_optimization', 4010, 'GPU clouds, scheduling, capacity management'),
  ('distributed_training', 'Distributed Training', 'specialization', 'infrastructure_optimization', 4020, 'Parallelization and large-scale model training'),
  ('fine_tuning_post_training', 'Fine-Tuning and Post-Training', 'specialization', 'infrastructure_optimization', 4030, 'Domain adaptation, reinforcement learning from feedback, alignment'),
  ('model_compression', 'Model Compression', 'specialization', 'infrastructure_optimization', 4040, 'Quantization, pruning, distillation'),
  ('inference_optimization', 'Inference Optimization', 'specialization', 'infrastructure_optimization', 4050, 'Latency, throughput, memory and cost reduction'),
  ('model_routing', 'Model Routing', 'specialization', 'infrastructure_optimization', 4060, 'Selecting models dynamically based on task or economics'),
  ('edge_ai', 'Edge AI', 'specialization', 'infrastructure_optimization', 4070, 'On-device and resource-constrained inference'),
  ('llmops_mlops', 'LLMOps / MLOps', 'specialization', 'infrastructure_optimization', 4080, 'Deployment, monitoring, lifecycle management'),
  ('model_evaluation_benchmarking', 'Model Evaluation and Benchmarking', 'specialization', 'infrastructure_optimization', 4090, 'Quality, accuracy, robustness and performance'),
  ('ai_observability', 'AI Observability', 'specialization', 'infrastructure_optimization', 4100, 'Tracing, monitoring, debugging'),
  ('privacy_preserving_ai', 'Privacy-Preserving AI', 'specialization', 'infrastructure_optimization', 4110, 'Federated learning, confidential computing'),
  ('ai_security_red_teaming', 'AI Security and Red Teaming', 'specialization', 'infrastructure_optimization', 4120, 'Adversarial testing, prompt-injection defense'),
  -- Specializations · Science, biology and healthcare
  ('bioinformatics', 'Bioinformatics', 'specialization', 'science_biology_healthcare', 5010, 'Computational analysis of biological data'),
  ('mechanistic_biology', 'Mechanistic Biology', 'specialization', 'science_biology_healthcare', 5020, 'Models incorporating biological mechanisms and pathways'),
  ('systems_biology', 'Systems Biology', 'specialization', 'science_biology_healthcare', 5030, 'Modeling interactions across biological systems'),
  ('genomics_transcriptomics', 'Genomics and Transcriptomics', 'specialization', 'science_biology_healthcare', 5040, 'DNA, RNA and gene expression analysis'),
  ('proteomics', 'Proteomics', 'specialization', 'science_biology_healthcare', 5050, 'Protein structure, function and interactions'),
  ('multi_omics_integration', 'Multi-Omics Integration', 'specialization', 'science_biology_healthcare', 5060, 'Combining genomics, proteomics, metabolomics and other omics'),
  ('single_cell_spatial_biology', 'Single-Cell and Spatial Biology', 'specialization', 'science_biology_healthcare', 5070, 'Cell-level and spatial molecular analysis'),
  ('microbiome_analysis', 'Microbiome Analysis', 'specialization', 'science_biology_healthcare', 5080, 'Microbial communities, metagenomics, host interactions'),
  ('multimodal_biological_clinical_ai', 'Multimodal Biological and Clinical AI', 'specialization', 'science_biology_healthcare', 5090, 'Integrating molecular, clinical, imaging and patient data'),
  ('protein_design', 'Protein Design', 'specialization', 'science_biology_healthcare', 5100, 'Generative and predictive protein engineering'),
  ('molecular_generation', 'Molecular Generation', 'specialization', 'science_biology_healthcare', 5110, 'Designing candidate molecules and compounds'),
  ('drug_discovery_ai', 'Drug Discovery AI', 'specialization', 'science_biology_healthcare', 5120, 'Target identification, screening, candidate optimization'),
  ('clinical_prediction', 'Clinical Prediction', 'specialization', 'science_biology_healthcare', 5130, 'Disease progression, outcomes, risk stratification'),
  ('medical_imaging_ai', 'Medical Imaging AI', 'specialization', 'science_biology_healthcare', 5140, 'Radiology, pathology, diagnostic imaging'),
  ('digital_twins_biology', 'Digital Twins in Biology', 'specialization', 'science_biology_healthcare', 5150, 'Computational representations of biological systems'),
  ('autonomous_laboratories', 'Autonomous Laboratories', 'specialization', 'science_biology_healthcare', 5160, 'AI-guided experimentation and robotic laboratories'),
  ('scientific_simulation', 'Scientific Simulation', 'specialization', 'science_biology_healthcare', 5170, 'Physics-informed models, surrogate models, simulation'),
  -- Specializations · Physical AI and industrial intelligence
  ('robotics_foundation_models', 'Robotics Foundation Models', 'specialization', 'physical_ai_industrial', 6010, 'Generalizable models for robotic systems'),
  ('vision_language_action_models', 'Vision-Language-Action Models', 'specialization', 'physical_ai_industrial', 6020, 'Translating perception and instructions into physical actions'),
  ('robot_learning', 'Robot Learning', 'specialization', 'physical_ai_industrial', 6030, 'Learning robot policies from demonstration, rewards or experience'),
  ('teleoperation_robotics_data', 'Teleoperation and Robotics Data', 'specialization', 'physical_ai_industrial', 6040, 'Remote control, data collection, human demonstrations'),
  ('embodied_agents', 'Embodied Agents', 'specialization', 'physical_ai_industrial', 6050, 'AI systems acting in physical environments'),
  ('autonomous_navigation', 'Autonomous Navigation', 'specialization', 'physical_ai_industrial', 6060, 'Localization, planning, navigation'),
  ('industrial_computer_vision', 'Industrial Computer Vision', 'specialization', 'physical_ai_industrial', 6070, 'Inspection, monitoring, machine perception'),
  ('predictive_maintenance', 'Predictive Maintenance', 'specialization', 'physical_ai_industrial', 6080, 'Equipment failure and operational forecasting'),
  ('digital_twins', 'Digital Twins', 'specialization', 'physical_ai_industrial', 6090, 'Virtual representations of industrial systems'),
  ('autonomous_vehicles_drones', 'Autonomous Vehicles and Drones', 'specialization', 'physical_ai_industrial', 6100, 'Perception, planning, control, autonomy'),
  -- Core AI methods
  ('reinforcement_learning', 'Reinforcement Learning', 'method', NULL, 7010, 'Learning behaviour from rewards'),
  ('imitation_learning', 'Imitation Learning', 'method', NULL, 7020, 'Learning behaviour from demonstrations'),
  ('supervised_learning', 'Supervised Learning', 'method', NULL, 7030, 'Learning from labeled examples'),
  ('self_supervised_learning', 'Self-Supervised Learning', 'method', NULL, 7040, 'Learning representations from unlabeled data'),
  ('multimodal_learning', 'Multimodal Learning', 'method', NULL, 7050, 'Learning jointly across several data modalities'),
  ('graph_neural_networks', 'Graph Neural Networks', 'method', NULL, 7060, 'Learning from graph-structured data'),
  ('causal_inference', 'Causal Inference', 'method', NULL, 7070, 'Causal inference and causal discovery'),
  ('bayesian_probabilistic_modeling', 'Bayesian / Probabilistic Modeling', 'method', NULL, 7080, 'Uncertainty estimation and Bayesian approaches'),
  ('symbolic_reasoning', 'Symbolic Reasoning', 'method', NULL, 7090, 'Logic and symbolic systems, alone or combined with neural models'),
  ('mechanistic_modeling', 'Mechanistic Modeling', 'method', NULL, 7100, 'Models built from known mechanisms rather than only from data'),
  ('physics_informed_ml', 'Physics-Informed Machine Learning', 'method', NULL, 7110, 'Models incorporating physical laws and constraints'),
  ('generative_modeling', 'Generative Modeling', 'method', NULL, 7120, 'Diffusion, autoregressive and other generative models'),
  ('model_distillation', 'Model Distillation', 'method', NULL, 7130, 'Training a smaller model to reproduce a larger one'),
  ('planning_tool_use', 'Planning and Tool Use', 'method', NULL, 7140, 'Multi-step planning and calling external tools'),
  ('explainability_interpretability', 'Explainability / Interpretability', 'method', NULL, 7150, 'Interpretability, feature attribution, explanations'),
  ('predictive_modeling', 'Predictive Modeling', 'method', NULL, 7160, 'Forecasting and predictive decision systems'),
  -- Data modalities
  ('text_data', 'Text', 'modality', NULL, 8010, NULL),
  ('image_data', 'Image', 'modality', NULL, 8020, NULL),
  ('video_data', 'Video', 'modality', NULL, 8030, NULL),
  ('audio_speech_data', 'Audio / Speech', 'modality', NULL, 8040, NULL),
  ('structured_tabular_data', 'Structured / Tabular', 'modality', NULL, 8050, NULL),
  ('time_series_data', 'Time Series', 'modality', NULL, 8060, NULL),
  ('graph_data', 'Graph', 'modality', NULL, 8070, NULL),
  ('geospatial_satellite_data', 'Geospatial / Satellite', 'modality', NULL, 8080, NULL),
  ('sensor_iot_data', 'Sensor / IoT', 'modality', NULL, 8090, NULL),
  ('genomic_data', 'Genomic', 'modality', NULL, 8100, NULL),
  ('transcriptomic_data', 'Transcriptomic', 'modality', NULL, 8110, NULL),
  ('proteomic_data', 'Proteomic', 'modality', NULL, 8120, NULL),
  ('metabolomic_data', 'Metabolomic', 'modality', NULL, 8130, NULL),
  ('microbiome_metagenomic_data', 'Microbiome / Metagenomic', 'modality', NULL, 8140, NULL),
  ('clinical_records_data', 'Clinical Records', 'modality', NULL, 8150, 'Electronic health records and other clinical data'),
  ('medical_imaging_data', 'Medical Imaging', 'modality', NULL, 8160, NULL),
  ('molecular_chemical_data', 'Molecular / Chemical', 'modality', NULL, 8170, NULL),
  ('robotics_trajectories_data', 'Robotics Trajectories', 'modality', NULL, 8180, NULL),
  -- Target domains
  ('computational_biology', 'Computational Biology', 'domain', NULL, 9010, 'Mathematical and computational modeling of biological systems'),
  ('drug_discovery', 'Drug Discovery', 'domain', NULL, 9020, NULL),
  ('clinical_care', 'Clinical Care', 'domain', NULL, 9030, NULL),
  ('medical_diagnostics', 'Medical Diagnostics', 'domain', NULL, 9040, NULL),
  ('materials_science', 'Materials Science', 'domain', NULL, 9050, NULL),
  ('chemistry', 'Chemistry', 'domain', NULL, 9060, NULL),
  ('physics', 'Physics', 'domain', NULL, 9070, NULL),
  ('robotics', 'Robotics', 'domain', NULL, 9080, NULL),
  ('industrial_operations', 'Industrial Operations', 'domain', NULL, 9090, NULL),
  ('cybersecurity', 'Cybersecurity', 'domain', NULL, 9100, NULL),
  ('software_engineering', 'Software Engineering', 'domain', NULL, 9110, NULL),
  ('financial_services', 'Financial Services', 'domain', NULL, 9120, NULL),
  ('legal_services', 'Legal Services', 'domain', NULL, 9130, NULL),
  ('scientific_research', 'Scientific Research', 'domain', NULL, 9140, NULL),
  ('earth_observation', 'Earth Observation', 'domain', NULL, 9150, NULL)
ON CONFLICT (slug) DO NOTHING;

-- Narrower terms point at their umbrella term, so filtering on the umbrella
-- (e.g. AI Agents) also finds startups tagged with a narrower one.
UPDATE technical_terms child
SET parent_term_id = parent.id
FROM (VALUES
  ('autonomous_research_agents', 'ai_agents'),
  ('autonomous_scientific_agents', 'autonomous_research_agents'),
  ('coding_agents', 'ai_agents'),
  ('computer_use_agents', 'ai_agents'),
  ('browser_web_agents', 'ai_agents'),
  ('vertical_ai_agents', 'ai_agents'),
  ('digital_twins_biology', 'digital_twins')
) AS link(child_slug, parent_slug)
JOIN technical_terms parent ON parent.slug = link.parent_slug
WHERE child.slug = link.child_slug AND child.parent_term_id IS NULL;

-- Aliases: abbreviations, synonyms, and spec terms merged into another facet
-- (see "Canonical facet mapping" in docs/technical-taxonomy.md).
INSERT INTO technical_term_aliases (term_id, alias)
SELECT t.id, a.alias
FROM (VALUES
  ('large_language_models', 'LLM'),
  ('large_language_models', 'LLMs'),
  ('small_language_models', 'SLM'),
  ('vision_language_models', 'VLM'),
  ('speech_audio_models', 'ASR'),
  ('speech_audio_models', 'TTS'),
  ('speech_audio_models', 'Speech recognition'),
  ('speech_audio_models', 'Text-to-speech'),
  ('biological_foundation_models', 'Protein language models'),
  ('ai_agents', 'Agentic AI'),
  ('ai_agents', 'Autonomous agents'),
  ('multi_agent_systems', 'MAS'),
  ('autonomous_scientific_agents', 'AI scientist'),
  ('coding_agents', 'AI coding assistant'),
  ('browser_web_agents', 'Web agents'),
  ('agent_tool_infrastructure', 'MCP'),
  ('agent_tool_infrastructure', 'Model Context Protocol'),
  ('agent_tool_infrastructure', 'Function calling'),
  ('retrieval_augmented_generation', 'RAG'),
  ('vector_databases_search', 'Vector search'),
  ('vector_databases_search', 'Embeddings'),
  ('vector_databases_search', 'Semantic search'),
  ('data_annotation_enrichment', 'Data labeling'),
  ('data_annotation_enrichment', 'Data labelling'),
  ('data_provenance', 'Data lineage'),
  ('gpu_infrastructure', 'GPU cloud'),
  ('fine_tuning_post_training', 'Fine-Tuning'),
  ('fine_tuning_post_training', 'Post-training'),
  ('fine_tuning_post_training', 'RLHF'),
  ('model_compression', 'Quantization'),
  ('model_compression', 'Pruning'),
  ('model_routing', 'LLM router'),
  ('edge_ai', 'On-device AI'),
  ('edge_ai', 'TinyML'),
  ('model_evaluation_benchmarking', 'Evals'),
  ('privacy_preserving_ai', 'Federated learning'),
  ('privacy_preserving_ai', 'Confidential computing'),
  ('ai_security_red_teaming', 'Prompt injection'),
  ('ai_security_red_teaming', 'Adversarial machine learning'),
  ('multi_omics_integration', 'Multi-omics'),
  ('microbiome_analysis', 'Metagenomics'),
  ('protein_design', 'Protein engineering'),
  ('molecular_generation', 'Generative chemistry'),
  ('medical_imaging_ai', 'Radiology AI'),
  ('medical_imaging_ai', 'Digital pathology'),
  ('autonomous_laboratories', 'Self-driving labs'),
  ('autonomous_laboratories', 'Lab automation'),
  ('scientific_simulation', 'Surrogate models'),
  ('vision_language_action_models', 'VLA'),
  ('robot_learning', 'Imitation and Reinforcement Learning'),
  ('autonomous_navigation', 'SLAM'),
  ('industrial_computer_vision', 'Visual inspection'),
  ('autonomous_vehicles_drones', 'Self-driving'),
  ('autonomous_vehicles_drones', 'UAV'),
  ('reinforcement_learning', 'RL'),
  ('imitation_learning', 'Learning from demonstration'),
  ('graph_neural_networks', 'Graph AI'),
  ('graph_neural_networks', 'GNN'),
  ('graph_neural_networks', 'Graph AI / Graph Neural Networks'),
  ('causal_inference', 'Causal AI'),
  ('bayesian_probabilistic_modeling', 'Probabilistic Modeling'),
  ('bayesian_probabilistic_modeling', 'Bayesian'),
  ('symbolic_reasoning', 'Hybrid and Symbolic Reasoning'),
  ('symbolic_reasoning', 'Neuro-symbolic AI'),
  ('physics_informed_ml', 'Physics-informed neural networks'),
  ('physics_informed_ml', 'PINN'),
  ('generative_modeling', 'Diffusion models'),
  ('generative_modeling', 'Generative AI'),
  ('model_distillation', 'Knowledge distillation'),
  ('planning_tool_use', 'Tool use'),
  ('explainability_interpretability', 'Explainable AI'),
  ('explainability_interpretability', 'XAI'),
  ('predictive_modeling', 'Predictive analytics'),
  ('clinical_records_data', 'EHR'),
  ('clinical_records_data', 'Electronic health records'),
  ('geospatial_satellite_data', 'Earth observation imagery'),
  ('robotics_trajectories_data', 'Robot demonstrations')
) AS a(slug, alias)
JOIN technical_terms t ON t.slug = a.slug
ON CONFLICT (normalized_alias) DO NOTHING;

-- ------------------------------------------------------------------
-- 6. Backfill from the legacy organizations.technology_layer
--
-- Only one legacy value maps without guessing: 'application' on an AI Radar
-- startup becomes primary layer AI-Native Applications, marked 'inferred' so
-- it shows as unverified until an editor reviews it. Every other legacy value
-- ('infrastructure', 'tooling', and 'application' outside the AI Radar) is
-- left unmapped and listed in docs/technical-taxonomy.md for manual review.
-- ------------------------------------------------------------------
INSERT INTO organization_technical_layers (organization_id, layer_id, is_primary, evidence_status, source_note)
SELECT o.id, l.id, true, 'inferred',
       'Backfilled from legacy technology_layer = application; review before treating as verified.'
FROM organizations o
JOIN technical_layers l ON l.slug = 'ai_native_applications'
WHERE o.technology_layer::text = 'application'
  AND EXISTS (
    SELECT 1 FROM product_organizations po
    JOIN product_catalog pc ON pc.id = po.product_id
    WHERE po.organization_id = o.id AND pc.slug = 'ai-radar'
  )
  AND NOT EXISTS (
    SELECT 1 FROM organization_technical_layers x
    WHERE x.organization_id = o.id AND x.is_primary
  )
ON CONFLICT (organization_id, layer_id) DO NOTHING;
