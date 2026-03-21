-- ============================================
-- SAMPLE VENTURES
-- ============================================

INSERT INTO ventures (
  name, slug, description, city, sector, stage,
  founded_date, first_seen_at,
  investor_brief, product_description, target_market, competitive_landscape,
  signal_count, last_signal_date,
  technology_layer, product_modality, venture_origin_type,
  technical_thesis, technology_stage, fundraising_status
) VALUES

('NovaMind AI', 'novamind-ai',
 'Autonomous agent framework for enterprise workflow orchestration.',
 'Paris', 'ai_agents', 'seed', '2026-01-15', '2026-01-20',
 'NovaMind AI is building an autonomous agent framework for enterprise workflow orchestration. The company was incorporated in January 2026 by a former DeepMind research lead with deep expertise in multi-agent systems and reinforcement learning. Early indicators suggest the company is preparing for a seed fundraise: rapid hiring in engineering (4 posts in 3 weeks), corporate entity restructuring, and advisory board formation. The founder''s track record — 6 years at DeepMind, 2 published papers on agent coordination — positions this as a high-signal opportunity in the enterprise AI agents space.',
 'An agent orchestration platform that enables enterprises to deploy, coordinate, and monitor autonomous AI agents across business workflows — from customer support escalation to internal ops automation.',
 'Mid-market and enterprise companies (500+ employees) with complex operational workflows. Initial vertical focus appears to be financial services and logistics.',
 'Competes with Dust (Paris), LangChain/LangSmith (US), CrewAI (US), and enterprise incumbents building in-house solutions. Differentiator is likely the multi-agent coordination layer.',
 3, '2026-03-14',
 'agent_platform', 'software', 'new_venture',
 'Multi-agent coordination layer with reinforcement learning for enterprise workflow automation.',
 'prototype', 'preparing_for_fundraising'),

('Katrix.AI', 'katrix-ai',
 'Hybrid perception stack for autonomous systems.',
 'Meudon', 'robotics', 'pre_seed', '2026-01-01', '2026-01-10',
 'Katrix.AI appears to be a relaunch of robotics perception technology following the liquidation of a prior robotics venture. The founder is building a hybrid deterministic + ML perception stack for autonomous systems. Early signals suggest the company is still in stealth mode with minimal public footprint.',
 'Perception infrastructure layer combining LiDAR, camera, and radar sensor fusion for autonomous robotic systems. Includes a perception SDK (ROS2, C++, Python) and an edge perception module.',
 'Industrial robotics and autonomous vehicle tier-1 suppliers, drones, maritime systems, energy monitoring, and defense.',
 'Competing against Outsight (Paris), Prophesee (Paris), and international players like Luminar and Ouster.',
 1, '2026-01-10',
 'perception', 'hybrid', 'founder_reboot',
 'Hybrid deterministic + machine learning perception architecture with explainable outputs and multi-sensor fusion.',
 'prototype', 'unknown'),

('BioSight', 'biosight',
 'AI-driven molecular imaging for drug discovery acceleration.',
 'Lyon', 'bioai', 'pre_seed', '2026-03-01', '2026-03-05',
 'BioSight is a CNRS spinout building AI-driven molecular imaging tools to accelerate early-stage drug discovery. A recent patent filing suggests the team is securing IP protection ahead of a likely fundraise. The academic pedigree is strong — the founding team includes two CNRS researchers with 15+ combined publications in computational biology.',
 'Machine learning platform that analyzes molecular imaging data to predict drug candidate efficacy at pre-clinical stage.',
 'Pharma R&D departments and biotech startups in pre-clinical drug discovery.',
 'Competes with Owkin (Paris), Iktos (Paris), and international platforms like Recursion Pharmaceuticals and Insilico Medicine.',
 2, '2026-03-12',
 'vertical_ai', 'software', 'research_spinout',
 'Deep learning applied to molecular imaging for predictive pre-clinical screening.',
 'prototype', 'likely_raising_within_12_months'),

('SentinelOps', 'sentinelops',
 'Autonomous threat detection and response for cloud infrastructure.',
 'Paris', 'cybersecurity_ai', 'seed', '2025-12-01', '2025-12-15',
 'SentinelOps is building autonomous threat detection for cloud-native infrastructure. The recent hire of an ex-Palo Alto Networks VP of Engineering is a strong signal — this caliber of hire typically precedes or accompanies a significant fundraise. Combined with 4 active signals in the past 30 days, this is one of the most active ventures on the radar.',
 'AI-powered security operations platform that autonomously detects, triages, and responds to threats across multi-cloud environments.',
 'Cloud-native enterprises and managed security service providers (MSSPs).',
 'Competes with Sekoia.io (Paris), HarfangLab (Paris), CrowdStrike, and SentinelOne internationally.',
 4, '2026-03-18',
 'vertical_ai', 'software', 'new_venture',
 'Autonomous threat triage and response using ML-driven anomaly detection across cloud telemetry.',
 'pilot', 'preparing_for_fundraising'),

('Axone', 'axone',
 'Neuromorphic computing chips for edge AI inference.',
 'Grenoble', 'deeptech', 'seed', '2025-10-01', '2025-11-20',
 'Axone is a CEA-Leti spinout developing neuromorphic computing chips optimized for edge AI inference. The company recently pivoted its go-to-market from general-purpose edge computing to a focused automotive use case, which could significantly sharpen its value proposition for Tier-1 automotive suppliers.',
 'Ultra-low-power neuromorphic processor designed for real-time AI inference at the edge, initially targeting automotive sensor processing.',
 'Automotive Tier-1 suppliers and OEMs for ADAS/autonomous driving sensor processing.',
 'Competes with GrAI Matter Labs (Paris, acquired), SynSense (Zurich), Intel Loihi, and IBM TrueNorth research programs.',
 1, '2026-02-28',
 'infrastructure', 'hardware', 'research_spinout',
 'Neuromorphic processor architecture enabling sub-milliwatt real-time inference at the edge.',
 'prototype', 'unknown'),

('Revero Health', 'revero-health',
 'AI copilot for clinical trial design and patient matching.',
 'Paris', 'healthtech_ai', 'seed', '2026-02-01', '2026-02-10',
 'Revero Health is led by a repeat founder whose previous healthtech company exited for an undisclosed amount. The new venture applies LLMs to clinical trial optimization — both in protocol design and patient recruitment. Early fundraising signals suggest a Series A-scale ambition given the founder''s track record.',
 'AI copilot that assists clinical research organizations in designing trial protocols and matching eligible patients from electronic health records.',
 'Contract Research Organizations (CROs), mid-size pharma companies, and academic medical centers.',
 'Competes with Lifen (Paris) for health data, and internationally with Unlearn.ai, TrialSpark, and Deep 6 AI.',
 2, '2026-03-15',
 'vertical_ai', 'software', 'new_venture',
 'LLM-based clinical trial protocol design and patient cohort matching from EHR data.',
 'pilot', 'likely_raising_within_12_months');

-- ============================================
-- FOUNDERS
-- ============================================

INSERT INTO founders (name, role, bio, founder_signals, has_big_tech_background, is_repeat_founder, has_phd) VALUES

('Adrien Morel', 'CEO & Co-Founder',
 'Former Research Lead at DeepMind (2019–2025). PhD in Multi-Agent Systems, ENS Paris-Saclay. 2 published papers on agent coordination and planning. Previously at Google Brain (intern, 2018).',
 ARRAY['big_tech_alumni']::founder_signal_type[], true, false, true),

('Léa Fontaine', 'CTO & Co-Founder',
 'Former Staff Engineer at Datadog (2020–2025). MSc Computer Science, École Polytechnique. Built Datadog''s internal workflow automation engine. Open-source contributor to LangChain.',
 ARRAY['big_tech_alumni']::founder_signal_type[], true, false, false),

('Cristian Sandu', 'CEO & Founder',
 'Previously founded QuadriBot, a robotics startup that was liquidated in 2025. Background in computer vision and sensor fusion. MSc INSA Lyon.',
 ARRAY['repeat_founder', 'corporate_reboot']::founder_signal_type[], false, true, false),

('Dr. Claire Dumont', 'CEO & Co-Founder',
 'CNRS Research Director, computational biology. 12 publications in molecular imaging and machine learning applications in drug discovery. PhD Université Claude Bernard Lyon 1.',
 ARRAY['academic_spinout']::founder_signal_type[], false, false, true),

('Dr. Thomas Roux', 'CTO & Co-Founder',
 'CNRS Researcher, 8 publications in AI for microscopy. Previously postdoc at Max Planck Institute. PhD ENS Lyon.',
 ARRAY['academic_spinout']::founder_signal_type[], false, false, true),

('Karim Benzarti', 'CEO & Co-Founder',
 'Former Principal Engineer at Thales Cybersecurity (2017–2025). Led autonomous threat response R&D. École Polytechnique + ENSTA Paris.',
 ARRAY['big_tech_alumni']::founder_signal_type[], true, false, false),

('Dr. Sophie Laurent', 'CEO & Co-Founder',
 'Former senior researcher at CEA-Leti (2018–2025). Expert in neuromorphic architectures. PhD in microelectronics, Université Grenoble Alpes. 6 patents.',
 ARRAY['academic_spinout']::founder_signal_type[], false, false, true),

('Antoine Mercier', 'CEO & Founder',
 'Repeat founder — previous healthtech exit (undisclosed). 10 years in clinical research technology. MBA HEC Paris, MSc Bioinformatics Université Paris-Saclay.',
 ARRAY['repeat_founder']::founder_signal_type[], false, true, false);

-- ============================================
-- VENTURE FOUNDERS  (link founders to ventures)
-- ============================================

INSERT INTO venture_founders (venture_id, founder_id, role)
SELECT v.id, f.id, f.role
FROM ventures v, founders f
WHERE v.slug = 'novamind-ai' AND f.name IN ('Adrien Morel', 'Léa Fontaine');

INSERT INTO venture_founders (venture_id, founder_id, role)
SELECT v.id, f.id, f.role
FROM ventures v, founders f
WHERE v.slug = 'katrix-ai' AND f.name = 'Cristian Sandu';

INSERT INTO venture_founders (venture_id, founder_id, role)
SELECT v.id, f.id, f.role
FROM ventures v, founders f
WHERE v.slug = 'biosight' AND f.name IN ('Dr. Claire Dumont', 'Dr. Thomas Roux');

INSERT INTO venture_founders (venture_id, founder_id, role)
SELECT v.id, f.id, f.role
FROM ventures v, founders f
WHERE v.slug = 'sentinelops' AND f.name = 'Karim Benzarti';

INSERT INTO venture_founders (venture_id, founder_id, role)
SELECT v.id, f.id, f.role
FROM ventures v, founders f
WHERE v.slug = 'axone' AND f.name = 'Dr. Sophie Laurent';

INSERT INTO venture_founders (venture_id, founder_id, role)
SELECT v.id, f.id, f.role
FROM ventures v, founders f
WHERE v.slug = 'revero-health' AND f.name = 'Antoine Mercier';

-- ============================================
-- FOUNDER VENTURES  (prior venture history)
-- ============================================

INSERT INTO founder_ventures (founder_id, venture_name, role, start_year, end_year, outcome)
SELECT f.id, 'QuadriBot', 'Founder & CEO', 2022, 2025, 'liquidation'
FROM founders f WHERE f.name = 'Cristian Sandu';

INSERT INTO founder_ventures (founder_id, venture_name, role, start_year, end_year, outcome)
SELECT f.id, 'Previous Healthtech Co.', 'CEO & Founder', 2018, 2024, 'exit (undisclosed)'
FROM founders f WHERE f.name = 'Antoine Mercier';

-- ============================================
-- VENTURE RELATIONSHIPS  (company lineage)
-- ============================================

-- Katrix.AI is a reboot of QuadriBot's technology stack
-- (QuadriBot is a previous company, not in the ventures table, so we record it in founder_ventures above.
--  If QuadriBot were in the ventures table, the relationship would be:)
-- INSERT INTO venture_relationships (parent_venture_id, child_venture_id, relationship_type, description)
-- SELECT p.id, c.id, 'reboot_of', 'Katrix.AI created after QuadriBot was liquidated in 2025. Perception technology and founder knowledge carried over.'
-- FROM ventures p, ventures c WHERE p.slug = 'quadribot' AND c.slug = 'katrix-ai';

-- ============================================
-- SIGNALS
-- ============================================

INSERT INTO signals (venture_id, signal_date, signal_type, strength, title, description) VALUES

-- NovaMind AI
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), '2026-03-14', 'advisory_formation', 'positive', 'Advisory board formation', 'Three advisors added: ex-Salesforce VP Product, Inria ML researcher, and a partner at a top-tier Paris VC.'),
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), '2026-03-08', 'key_hire', 'positive', '4th engineering hire posted', 'Senior ML Engineer role posted on Welcome to the Jungle. Focus on multi-agent coordination.'),
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), '2026-02-22', 'restructuring', 'positive', 'Corporate restructuring', 'SAS entity converted to SA. Commonly precedes external fundraising.'),
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), '2026-01-15', 'incorporation', 'neutral', 'Company incorporated', 'NovaMind AI SAS registered in Paris. Initial capital: €10,000.'),
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), '2025-12-02', 'founder_departure', 'neutral', 'Founder departure from DeepMind', 'Lead researcher exits DeepMind London. LinkedIn updated with "Building something new."'),

-- Katrix.AI
((SELECT id FROM ventures WHERE slug = 'katrix-ai'), '2026-01-10', 'incorporation', 'neutral', 'Company registered', 'Katrix.AI SAS registered in Meudon. Minimal public information available.'),

-- BioSight
((SELECT id FROM ventures WHERE slug = 'biosight'), '2026-03-12', 'patent_ip', 'positive', 'Patent filing detected', 'European patent application filed for AI-assisted molecular imaging classification method.'),
((SELECT id FROM ventures WHERE slug = 'biosight'), '2026-03-05', 'incorporation', 'neutral', 'CNRS spinout incorporated', 'BioSight SAS incorporated in Lyon with CNRS technology transfer agreement.'),

-- SentinelOps
((SELECT id FROM ventures WHERE slug = 'sentinelops'), '2026-03-18', 'key_hire', 'positive', 'VP Engineering hired from Palo Alto Networks', 'Former VP Engineering at Palo Alto Networks joins as CTO. 15 years in cybersecurity.'),
((SELECT id FROM ventures WHERE slug = 'sentinelops'), '2026-03-01', 'fundraising', 'positive', 'Fundraising signals detected', 'Multiple VC meetings reported. Estimated seed round of €3-5M.'),
((SELECT id FROM ventures WHERE slug = 'sentinelops'), '2026-02-10', 'key_hire', 'positive', 'Head of Sales hired', 'Former Sekoia.io sales lead joins. Signal of go-to-market readiness.'),
((SELECT id FROM ventures WHERE slug = 'sentinelops'), '2025-12-15', 'incorporation', 'neutral', 'Company incorporated', 'SentinelOps SAS registered in Paris.'),

-- Axone
((SELECT id FROM ventures WHERE slug = 'axone'), '2026-02-28', 'pivot', 'warning', 'Pivot to automotive vertical', 'Company appears to have narrowed focus from general edge AI to automotive ADAS applications.'),

-- Revero Health
((SELECT id FROM ventures WHERE slug = 'revero-health'), '2026-03-15', 'fundraising', 'positive', 'Fundraising activity detected', 'Founder seen at multiple VC events in Paris. Advisory connections suggest interest from top-tier health fund.'),
((SELECT id FROM ventures WHERE slug = 'revero-health'), '2026-02-10', 'incorporation', 'neutral', 'Company incorporated', 'Revero Health SAS registered in Paris by repeat founder Antoine Mercier.');

-- ============================================
-- VENTURE TAGS  (formerly startup_badges)
-- ============================================

INSERT INTO venture_tags (venture_id, label, strength) VALUES
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), 'Fundraising Signal', 'positive'),
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), 'Big Tech Alumni', 'positive'),
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), 'DeepMind Founder', 'positive'),
((SELECT id FROM ventures WHERE slug = 'katrix-ai'), 'Founder Reboot', 'warning'),
((SELECT id FROM ventures WHERE slug = 'katrix-ai'), 'First Seen Jan 2026', 'neutral'),
((SELECT id FROM ventures WHERE slug = 'katrix-ai'), 'Prior Liquidation', 'warning'),
((SELECT id FROM ventures WHERE slug = 'biosight'), 'IP Signal', 'positive'),
((SELECT id FROM ventures WHERE slug = 'biosight'), 'Academic Spinout', 'neutral'),
((SELECT id FROM ventures WHERE slug = 'sentinelops'), 'Key Hire', 'positive'),
((SELECT id FROM ventures WHERE slug = 'sentinelops'), 'Fundraising Signal', 'positive'),
((SELECT id FROM ventures WHERE slug = 'axone'), 'Academic Spinout', 'neutral'),
((SELECT id FROM ventures WHERE slug = 'axone'), 'Pivot', 'warning'),
((SELECT id FROM ventures WHERE slug = 'revero-health'), 'Fundraising Signal', 'positive'),
((SELECT id FROM ventures WHERE slug = 'revero-health'), 'Repeat Founder', 'positive');

-- ============================================
-- PRODUCTS
-- ============================================

INSERT INTO products (venture_id, name, description, product_type, modality, status) VALUES
((SELECT id FROM ventures WHERE slug = 'katrix-ai'), 'Perception SDK', 'ROS2-compatible SDK for multi-sensor fusion. Python and C++ bindings. Supports LiDAR, camera, and radar inputs.', 'sdk', 'software', 'development'),
((SELECT id FROM ventures WHERE slug = 'katrix-ai'), 'Edge Perception Module', 'Compact hardware module ("Black Box") embedding the perception stack for deployment on autonomous platforms.', 'hardware_module', 'hardware', 'concept'),
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), 'Agent Orchestration Platform', 'Enterprise platform for deploying and coordinating multi-agent AI workflows across business operations.', 'platform', 'software', 'beta'),
((SELECT id FROM ventures WHERE slug = 'sentinelops'), 'ThreatOps Platform', 'Cloud-native autonomous threat detection and response platform. Multi-cloud support (AWS, GCP, Azure).', 'platform', 'software', 'pilot'),
((SELECT id FROM ventures WHERE slug = 'revero-health'), 'Trial Copilot', 'AI assistant for clinical trial protocol design and patient cohort matching from EHR data.', 'platform', 'software', 'pilot');

-- ============================================
-- LEGAL ENTITIES
-- ============================================

INSERT INTO legal_entities (venture_id, legal_name, legal_form, registered_city, is_primary, incorporation_date) VALUES
((SELECT id FROM ventures WHERE slug = 'novamind-ai'), 'NovaMind AI SA', 'SA', 'Paris', true, '2026-02-22'),
((SELECT id FROM ventures WHERE slug = 'katrix-ai'), 'Katrix.AI SAS', 'SAS', 'Meudon', true, '2026-01-01'),
((SELECT id FROM ventures WHERE slug = 'biosight'), 'BioSight SAS', 'SAS', 'Lyon', true, '2026-03-01'),
((SELECT id FROM ventures WHERE slug = 'sentinelops'), 'SentinelOps SAS', 'SAS', 'Paris', true, '2025-12-01'),
((SELECT id FROM ventures WHERE slug = 'axone'), 'Axone SAS', 'SAS', 'Grenoble', true, '2025-10-01'),
((SELECT id FROM ventures WHERE slug = 'revero-health'), 'Revero Health SAS', 'SAS', 'Paris', true, '2026-02-01');
