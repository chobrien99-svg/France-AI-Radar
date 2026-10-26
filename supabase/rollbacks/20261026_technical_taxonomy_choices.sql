-- Rollback for supabase/migrations/20261026_technical_taxonomy_choices.sql
--
-- Removes the 16 terms it added (and, through ON DELETE, their aliases).
-- Fails if a startup is already linked to one of them: unlink those first,
-- or retire the term (is_active = false) instead of rolling back.
-- Restores the 8 aliases the migration removed.
--
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

DELETE FROM technical_terms WHERE slug IN (
  'graph_ai_gnn', 'hybrid_symbolic_reasoning', 'causal_ai', 'explainable_ai',
  'predictive_modeling_systems', 'probabilistic_modeling', 'computational_biology_tools',
  'imitation_reinforcement_learning', 'physics_informed_ml_systems',
  'retrieval_augmented_generation_method', 'fine_tuning', 'dynamic_routing', 'model_evaluation',
  'multi_omics_data', 'ai_for_science', 'model_development'
);

INSERT INTO technical_term_aliases (term_id, alias)
SELECT t.id, a.alias
FROM (VALUES
  ('graph_neural_networks', 'Graph AI / Graph Neural Networks'),
  ('symbolic_reasoning', 'Hybrid and Symbolic Reasoning'),
  ('causal_inference', 'Causal AI'),
  ('explainability_interpretability', 'Explainable AI'),
  ('bayesian_probabilistic_modeling', 'Probabilistic Modeling'),
  ('robot_learning', 'Imitation and Reinforcement Learning'),
  ('fine_tuning_post_training', 'Fine-Tuning'),
  ('multi_omics_integration', 'Multi-omics')
) AS a(slug, alias)
JOIN technical_terms t ON t.slug = a.slug
ON CONFLICT (normalized_alias) DO NOTHING;
