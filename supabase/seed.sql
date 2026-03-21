-- ============================================
-- SAMPLE STARTUPS
-- ============================================

INSERT INTO startups (name, slug, description, city, sector, stage, founded_date, first_seen_date, investor_brief, product_description, target_market, competitive_landscape, signal_count, last_signal_date) VALUES

('NovaMind AI', 'novamind-ai',
 'Autonomous agent framework for enterprise workflow orchestration.',
 'Paris', 'ai_agents', 'seed', '2026-01-15', '2026-01-20',
 'NovaMind AI is building an autonomous agent framework for enterprise workflow orchestration. The company was incorporated in January 2026 by a former DeepMind research lead with deep expertise in multi-agent systems and reinforcement learning. Early indicators suggest the company is preparing for a seed fundraise: rapid hiring in engineering (4 posts in 3 weeks), corporate entity restructuring, and advisory board formation. The founder''s track record — 6 years at DeepMind, 2 published papers on agent coordination — positions this as a high-signal opportunity in the enterprise AI agents space.',
 'An agent orchestration platform that enables enterprises to deploy, coordinate, and monitor autonomous AI agents across business workflows — from customer support escalation to internal ops automation.',
 'Mid-market and enterprise companies (500+ employees) with complex operational workflows. Initial vertical focus appears to be financial services and logistics.',
 'Competes with Dust (Paris), LangChain/LangSmith (US), CrewAI (US), and enterprise incumbents building in-house solutions. Differentiator is likely the multi-agent coordination layer.',
 3, '2026-03-14'),

('Katrix.AI', 'katrix-ai',
 'Hybrid perception stack for autonomous systems.',
 'Meudon', 'robotics', 'pre_seed', '2025-11-01', '2026-01-10',
 'Katrix.AI appears to be a relaunch of robotics perception technology, focused on building a hybrid perception stack for autonomous systems. The founder has prior experience in robotics but details of the previous venture are limited. Early signals suggest the company is still in stealth mode with minimal public footprint.',
 'Perception infrastructure layer combining LiDAR, camera, and radar sensor fusion for autonomous robotic systems.',
 'Industrial robotics and autonomous vehicle tier-1 suppliers.',
 'Competing against Outsight (Paris), Prophesee (Paris), and international players like Luminar and Ouster.',
 1, '2026-01-10'),

('BioSight', 'biosight',
 'AI-driven molecular imaging for drug discovery acceleration.',
 'Lyon', 'bioai', 'pre_seed', '2026-03-01', '2026-03-05',
 'BioSight is a CNRS spinout building AI-driven molecular imaging tools to accelerate early-stage drug discovery. A recent patent filing suggests the team is securing IP protection ahead of a likely fundraise. The academic pedigree is strong — the founding team includes two CNRS researchers with 15+ combined publications in computational biology.',
 'Machine learning platform that analyzes molecular imaging data to predict drug candidate efficacy at pre-clinical stage.',
 'Pharma R&D departments and biotech startups in pre-clinical drug discovery.',
 'Competes with Owkin (Paris), Iktos (Paris), and international platforms like Recursion Pharmaceuticals and Insilico Medicine.',
 2, '2026-03-12'),

('SentinelOps', 'sentinelops',
 'Autonomous threat detection and response for cloud infrastructure.',
 'Paris', 'cybersecurity_ai', 'seed', '2025-12-01', '2025-12-15',
 'SentinelOps is building autonomous threat detection for cloud-native infrastructure. The recent hire of an ex-Palo Alto Networks VP of Engineering is a strong signal — this caliber of hire typically precedes or accompanies a significant fundraise. Combined with 4 active signals in the past 30 days, this is one of the most active startups on the radar.',
 'AI-powered security operations platform that autonomously detects, triages, and responds to threats across multi-cloud environments.',
 'Cloud-native enterprises and managed security service providers (MSSPs).',
 'Competes with Sekoia.io (Paris), HarfangLab (Paris), CrowdStrike, and SentinelOne internationally.',
 4, '2026-03-18'),

('Axone', 'axone',
 'Neuromorphic computing chips for edge AI inference.',
 'Grenoble', 'deeptech', 'seed', '2025-10-01', '2025-11-20',
 'Axone is a CEA-Leti spinout developing neuromorphic computing chips optimized for edge AI inference. The company recently pivoted its go-to-market from general-purpose edge computing to a focused automotive use case, which could significantly sharpen its value proposition for Tier-1 automotive suppliers.',
 'Ultra-low-power neuromorphic processor designed for real-time AI inference at the edge, initially targeting automotive sensor processing.',
 'Automotive Tier-1 suppliers and OEMs for ADAS/autonomous driving sensor processing.',
 'Competes with GrAI Matter Labs (Paris, acquired), SynSense (Zurich), Intel Loihi, and IBM TrueNorth research programs.',
 1, '2026-02-28'),

('Revero Health', 'revero-health',
 'AI copilot for clinical trial design and patient matching.',
 'Paris', 'healthtech_ai', 'seed', '2026-02-01', '2026-02-10',
 'Revero Health is led by a repeat founder whose previous healthtech company exited for an undisclosed amount. The new venture applies LLMs to clinical trial optimization — both in protocol design and patient recruitment. Early fundraising signals suggest a Series A-scale ambition given the founder''s track record.',
 'AI copilot that assists clinical research organizations in designing trial protocols and matching eligible patients from electronic health records.',
 'Contract Research Organizations (CROs), mid-size pharma companies, and academic medical centers.',
 'Competes with Lifen (Paris) for health data, and internationally with Unlearn.ai, TrialSpark, and Deep 6 AI.',
 2, '2026-03-15');

-- ============================================
-- FOUNDERS
-- ============================================

INSERT INTO founders (startup_id, name, role, bio, founder_signals) VALUES

((SELECT id FROM startups WHERE slug = 'novamind-ai'),
 'Adrien Morel', 'CEO & Co-Founder',
 'Former Research Lead at DeepMind (2019–2025). PhD in Multi-Agent Systems, ENS Paris-Saclay. 2 published papers on agent coordination and planning. Previously at Google Brain (intern, 2018).',
 ARRAY['big_tech_alumni']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'novamind-ai'),
 'Léa Fontaine', 'CTO & Co-Founder',
 'Former Staff Engineer at Datadog (2020–2025). MSc Computer Science, École Polytechnique. Built Datadog''s internal workflow automation engine. Open-source contributor to LangChain.',
 ARRAY['big_tech_alumni']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'katrix-ai'),
 'Marc Vidal', 'CEO & Founder',
 'Previously founded a robotics perception startup (2019–2023). Background in computer vision and sensor fusion. MSc INSA Lyon.',
 ARRAY['repeat_founder', 'corporate_reboot']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'biosight'),
 'Dr. Claire Dumont', 'CEO & Co-Founder',
 'CNRS Research Director, computational biology. 12 publications in molecular imaging and machine learning applications in drug discovery. PhD Université Claude Bernard Lyon 1.',
 ARRAY['academic_spinout']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'biosight'),
 'Dr. Thomas Roux', 'CTO & Co-Founder',
 'CNRS Researcher, 8 publications in AI for microscopy. Previously postdoc at Max Planck Institute. PhD ENS Lyon.',
 ARRAY['academic_spinout']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'sentinelops'),
 'Karim Benzarti', 'CEO & Co-Founder',
 'Former Principal Engineer at Thales Cybersecurity (2017–2025). Led autonomous threat response R&D. École Polytechnique + ENSTA Paris.',
 ARRAY['big_tech_alumni']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'axone'),
 'Dr. Sophie Laurent', 'CEO & Co-Founder',
 'Former senior researcher at CEA-Leti (2018–2025). Expert in neuromorphic architectures. PhD in microelectronics, Université Grenoble Alpes. 6 patents.',
 ARRAY['academic_spinout']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'revero-health'),
 'Antoine Mercier', 'CEO & Founder',
 'Repeat founder — previous healthtech exit (undisclosed). 10 years in clinical research technology. MBA HEC Paris, MSc Bioinformatics Université Paris-Saclay.',
 ARRAY['repeat_founder']::founder_signal_type[]);

-- ============================================
-- SIGNALS
-- ============================================

INSERT INTO signals (startup_id, signal_date, signal_type, strength, title, description) VALUES

-- NovaMind AI
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2026-03-14', 'advisory_formation', 'positive', 'Advisory board formation', 'Three advisors added: ex-Salesforce VP Product, Inria ML researcher, and a partner at a top-tier Paris VC.'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2026-03-08', 'key_hire', 'positive', '4th engineering hire posted', 'Senior ML Engineer role posted on Welcome to the Jungle. Focus on multi-agent coordination.'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2026-02-22', 'restructuring', 'positive', 'Corporate restructuring', 'SAS entity converted to SA. Commonly precedes external fundraising.'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2026-01-15', 'incorporation', 'neutral', 'Company incorporated', 'NovaMind AI SAS registered in Paris. Initial capital: €10,000.'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2025-12-02', 'founder_departure', 'neutral', 'Founder departure from DeepMind', 'Lead researcher exits DeepMind London. LinkedIn updated with "Building something new."'),

-- Katrix.AI
((SELECT id FROM startups WHERE slug = 'katrix-ai'), '2026-01-10', 'incorporation', 'neutral', 'Company registered', 'Katrix.AI SAS registered in Meudon. Minimal public information available.'),

-- BioSight
((SELECT id FROM startups WHERE slug = 'biosight'), '2026-03-12', 'patent_ip', 'positive', 'Patent filing detected', 'European patent application filed for AI-assisted molecular imaging classification method.'),
((SELECT id FROM startups WHERE slug = 'biosight'), '2026-03-05', 'incorporation', 'neutral', 'CNRS spinout incorporated', 'BioSight SAS incorporated in Lyon with CNRS technology transfer agreement.'),

-- SentinelOps
((SELECT id FROM startups WHERE slug = 'sentinelops'), '2026-03-18', 'key_hire', 'positive', 'VP Engineering hired from Palo Alto Networks', 'Former VP Engineering at Palo Alto Networks joins as CTO. 15 years in cybersecurity.'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), '2026-03-01', 'fundraising', 'positive', 'Fundraising signals detected', 'Multiple VC meetings reported. Estimated seed round of €3-5M.'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), '2026-02-10', 'key_hire', 'positive', 'Head of Sales hired', 'Former Sekoia.io sales lead joins. Signal of go-to-market readiness.'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), '2025-12-15', 'incorporation', 'neutral', 'Company incorporated', 'SentinelOps SAS registered in Paris.'),

-- Axone
((SELECT id FROM startups WHERE slug = 'axone'), '2026-02-28', 'pivot', 'warning', 'Pivot to automotive vertical', 'Company appears to have narrowed focus from general edge AI to automotive ADAS applications.'),

-- Revero Health
((SELECT id FROM startups WHERE slug = 'revero-health'), '2026-03-15', 'fundraising', 'positive', 'Fundraising activity detected', 'Founder seen at multiple VC events in Paris. Advisory connections suggest interest from top-tier health fund.'),
((SELECT id FROM startups WHERE slug = 'revero-health'), '2026-02-10', 'incorporation', 'neutral', 'Company incorporated', 'Revero Health SAS registered in Paris by repeat founder Antoine Mercier.');

-- ============================================
-- BADGES
-- ============================================

INSERT INTO startup_badges (startup_id, label, strength) VALUES
((SELECT id FROM startups WHERE slug = 'novamind-ai'), 'Fundraising Signal', 'positive'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), 'Founder Reboot', 'warning'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), 'Big Tech Alumni', 'positive'),
((SELECT id FROM startups WHERE slug = 'katrix-ai'), 'Founder Reboot', 'warning'),
((SELECT id FROM startups WHERE slug = 'katrix-ai'), 'First Seen Jan 2026', 'neutral'),
((SELECT id FROM startups WHERE slug = 'biosight'), 'IP Signal', 'positive'),
((SELECT id FROM startups WHERE slug = 'biosight'), 'Academic Spinout', 'neutral'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), 'Key Hire', 'positive'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), 'Fundraising Signal', 'positive'),
((SELECT id FROM startups WHERE slug = 'axone'), 'Academic Spinout', 'neutral'),
((SELECT id FROM startups WHERE slug = 'axone'), 'Pivot', 'warning'),
((SELECT id FROM startups WHERE slug = 'revero-health'), 'Fundraising Signal', 'positive'),
((SELECT id FROM startups WHERE slug = 'revero-health'), 'Repeat Founder', 'positive');
