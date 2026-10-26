-- Technical taxonomy, part 2: every choice listed in the handoff, in the list
-- where the handoff puts it, plus the choices used in its examples.
-- Requires 20261025_technical_taxonomy.sql. Additive and safe to run twice.
-- Rollback: supabase/rollbacks/20261026_technical_taxonomy_choices.sql
--
-- The first migration folded 11 overlapping phrases into a single facet as
-- aliases (e.g. "Explainable AI" only as a method). They are now real terms in
-- their listed facet as well. The two terms answer different questions: the
-- specialization is what a company builds; the method is a technique it
-- applies. Each definition points to its counterpart.

INSERT INTO technical_terms (slug, label, facet, family, display_order, definition) VALUES
  -- Specializations · Data, knowledge and reasoning
  ('graph_ai_gnn', 'Graph AI / Graph Neural Networks', 'specialization', 'data_knowledge_reasoning', 3015, 'Learning from graph-structured data as a product capability. Technique: Core AI methods › Graph Neural Networks'),
  ('hybrid_symbolic_reasoning', 'Hybrid and Symbolic Reasoning', 'specialization', 'data_knowledge_reasoning', 3032, 'Systems combining neural models with logic or symbolic reasoning. Technique: Core AI methods › Symbolic Reasoning'),
  ('causal_ai', 'Causal AI', 'specialization', 'data_knowledge_reasoning', 3034, 'Causal inference and causal discovery products. Technique: Core AI methods › Causal Inference'),
  ('explainable_ai', 'Explainable AI', 'specialization', 'data_knowledge_reasoning', 3036, 'Interpretability, feature attribution and explanation products. Technique: Core AI methods › Explainability / Interpretability'),
  ('predictive_modeling_systems', 'Predictive Modeling', 'specialization', 'data_knowledge_reasoning', 3037, 'Forecasting and predictive decision systems as a product. Technique: Core AI methods › Predictive Modeling'),
  ('probabilistic_modeling', 'Probabilistic Modeling', 'specialization', 'data_knowledge_reasoning', 3038, 'Uncertainty estimation and Bayesian products. Technique: Core AI methods › Bayesian / Probabilistic Modeling'),
  -- Specializations · Science, biology and healthcare
  ('computational_biology_tools', 'Computational Biology', 'specialization', 'science_biology_healthcare', 5015, 'Mathematical and computational modeling of biological systems as a product. Field served: Target domains › Computational Biology'),
  -- Specializations · Physical AI and industrial intelligence
  ('imitation_reinforcement_learning', 'Imitation and Reinforcement Learning', 'specialization', 'physical_ai_industrial', 6035, 'Learning robot actions through demonstrations and rewards. Techniques: Core AI methods › Imitation Learning, Reinforcement Learning'),
  ('physics_informed_ml_systems', 'Physics-Informed Machine Learning', 'specialization', 'physical_ai_industrial', 6095, 'Models incorporating physical laws and constraints for industrial systems. Technique: Core AI methods › Physics-Informed Machine Learning'),
  -- Core AI methods
  ('retrieval_augmented_generation_method', 'Retrieval-Augmented Generation', 'method', NULL, 7122, 'Grounding model outputs in retrieved documents. Capability: Technical specializations › Retrieval-Augmented Generation'),
  ('fine_tuning', 'Fine-Tuning', 'method', NULL, 7124, 'Adapting a pretrained model to a task or domain. Capability: Technical specializations › Fine-Tuning and Post-Training'),
  ('dynamic_routing', 'Dynamic Routing', 'method', NULL, 7170, 'Choosing a model, path or resource per request at run time'),
  ('model_evaluation', 'Model Evaluation', 'method', NULL, 7180, 'Measuring model quality, accuracy and robustness'),
  -- Data modalities
  ('multi_omics_data', 'Multi-Omics', 'modality', NULL, 8145, 'Several omics layers (genomic, transcriptomic, proteomic, metabolomic) combined'),
  -- Target domains
  ('ai_for_science', 'AI for Science', 'domain', NULL, 9160, 'Applying AI to scientific discovery across disciplines'),
  ('model_development', 'Model Development', 'domain', NULL, 9170, 'Building, training and improving AI models themselves')
ON CONFLICT (slug) DO NOTHING;

-- These phrases are now term labels, so they no longer need to be aliases.
DELETE FROM technical_term_aliases
WHERE normalized_alias IN (
  'graph ai / graph neural networks', 'hybrid and symbolic reasoning', 'causal ai',
  'explainable ai', 'probabilistic modeling', 'imitation and reinforcement learning', 'fine-tuning',
  'multi-omics'
);

-- Search terms for the new choices
INSERT INTO technical_term_aliases (term_id, alias)
SELECT t.id, a.alias
FROM (VALUES
  ('explainable_ai', 'XAI products'),
  ('dynamic_routing', 'Request routing'),
  ('model_evaluation', 'Model testing'),
  ('ai_for_science', 'AI4Science'),
  ('ai_for_science', 'Scientific AI')
) AS a(slug, alias)
JOIN technical_terms t ON t.slug = a.slug
ON CONFLICT (normalized_alias) DO NOTHING;
