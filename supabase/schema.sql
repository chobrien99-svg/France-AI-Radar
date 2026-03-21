-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE sector_type AS ENUM (
  'ai_agents', 'robotics', 'bioai', 'deeptech', 'cybersecurity_ai',
  'fintech_ai', 'healthtech_ai', 'edtech_ai', 'climate_ai', 'legaltech_ai',
  'logistics_ai', 'manufacturing_ai', 'other'
);

CREATE TYPE signal_type AS ENUM (
  'fundraising', 'key_hire', 'restructuring', 'patent_ip',
  'pivot', 'product_launch', 'partnership', 'founder_departure',
  'advisory_formation', 'incorporation',
  'pilot_program', 'accelerator', 'innovation_program',
  'research_collaboration', 'technology_demo'
);

CREATE TYPE founder_signal_type AS ENUM (
  'big_tech_alumni', 'repeat_founder', 'academic_spinout', 'corporate_reboot'
);

CREATE TYPE stage_type AS ENUM (
  'pre_seed', 'seed', 'series_a', 'series_b_plus', 'unknown'
);

CREATE TYPE signal_strength AS ENUM (
  'positive', 'warning', 'risk', 'neutral'
);

CREATE TYPE subscription_tier AS ENUM (
  'free', 'explorer', 'professional', 'enterprise'
);

CREATE TYPE technology_layer_type AS ENUM (
  'perception', 'robotics', 'agent_platform', 'orchestration',
  'vertical_ai', 'infrastructure', 'other'
);

CREATE TYPE product_modality_type AS ENUM (
  'software', 'hardware', 'hybrid'
);

CREATE TYPE venture_origin_type AS ENUM (
  'new_venture', 'founder_reboot', 'research_spinout',
  'consultancy_evolution', 'venture_studio_launch'
);

CREATE TYPE technology_stage_type AS ENUM (
  'concept', 'prototype', 'pilot', 'production'
);

CREATE TYPE fundraising_status_type AS ENUM (
  'preparing_for_fundraising', 'likely_raising_within_12_months',
  'not_currently_raising', 'unknown'
);

CREATE TYPE venture_relationship_type AS ENUM (
  'founded_by_previous_company', 'technology_spinout', 'reboot_of',
  'pivot_from', 'asset_transfer'
);

-- ============================================
-- VENTURES
-- ============================================

CREATE TABLE ventures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  city TEXT,
  country TEXT DEFAULT 'France',
  sector sector_type NOT NULL,
  stage stage_type DEFAULT 'unknown',
  founded_date DATE,
  first_seen_at DATE DEFAULT CURRENT_DATE,
  incorporation_date DATE,

  -- Core narrative
  investor_brief TEXT,
  product_description TEXT,
  target_market TEXT,
  competitive_landscape TEXT,

  -- Strategy & intelligence
  company_origin TEXT,
  current_strategy TEXT,
  business_model_hypothesis TEXT,
  analyst_note TEXT,

  -- Technology classification
  technology_layer technology_layer_type,
  product_modality product_modality_type DEFAULT 'software',
  technical_thesis TEXT,
  technology_stage technology_stage_type,

  -- Venture origin
  venture_origin_type venture_origin_type DEFAULT 'new_venture',

  -- Fundraising
  total_raised_eur NUMERIC,
  last_round TEXT,
  est_next_raise TEXT,
  funding_notes TEXT,
  fundraising_status fundraising_status_type DEFAULT 'unknown',
  fundraising_signal_summary TEXT,

  -- Legal
  entity_complexity TEXT,

  -- Denormalised counts / cache
  is_active BOOLEAN DEFAULT true,
  signal_count INTEGER DEFAULT 0,
  last_signal_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOUNDERS
-- ============================================

CREATE TABLE founders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  bio TEXT,
  linkedin_url TEXT,
  founder_signals founder_signal_type[],

  -- Pedigree filter fields (used by investor filters)
  previous_companies TEXT[],
  has_phd BOOLEAN DEFAULT false,
  is_repeat_founder BOOLEAN DEFAULT false,
  has_big_tech_background BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VENTURE FOUNDERS  (junction: ventures ↔ founders)
-- ============================================

CREATE TABLE venture_founders (
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  founder_id UUID REFERENCES founders(id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (venture_id, founder_id)
);

-- ============================================
-- VENTURE RELATIONSHIPS  (company lineage)
-- ============================================

CREATE TABLE venture_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_venture_id UUID REFERENCES ventures(id) ON DELETE SET NULL,
  child_venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  relationship_type venture_relationship_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOUNDER VENTURES  (founder history outside current ventures)
-- ============================================

CREATE TABLE founder_ventures (
  founder_id UUID REFERENCES founders(id) ON DELETE CASCADE,
  venture_name TEXT NOT NULL,
  role TEXT,
  start_year INT,
  end_year INT,
  outcome TEXT,
  PRIMARY KEY (founder_id, venture_name)
);

-- ============================================
-- VENTURE EVENTS  (major dated milestones)
-- ============================================

CREATE TABLE venture_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type signal_type NOT NULL,
  strength signal_strength DEFAULT 'neutral',
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SIGNALS  (real-time intelligence feed)
-- ============================================

CREATE TABLE signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  signal_date DATE NOT NULL,
  signal_type signal_type NOT NULL,
  strength signal_strength DEFAULT 'neutral',
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS
-- ============================================

CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT,
  modality product_modality_type DEFAULT 'software',
  status TEXT DEFAULT 'development',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEGAL ENTITIES
-- ============================================

CREATE TABLE legal_entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  legal_form TEXT,
  siren TEXT UNIQUE,
  siret TEXT,
  capital_eur NUMERIC,
  incorporation_date DATE,
  registered_city TEXT,
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VENTURE TAGS  (formerly startup_badges)
-- ============================================

CREATE TABLE venture_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  strength signal_strength DEFAULT 'neutral',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER PROFILES & SUBSCRIPTIONS
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  subscription_tier subscription_tier DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SAVED SEARCHES
-- ============================================

CREATE TABLE saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_ventures_sector ON ventures(sector);
CREATE INDEX idx_ventures_stage ON ventures(stage);
CREATE INDEX idx_ventures_city ON ventures(city);
CREATE INDEX idx_ventures_last_signal ON ventures(last_signal_date DESC);
CREATE INDEX idx_ventures_first_seen ON ventures(first_seen_at DESC);
CREATE INDEX idx_ventures_fundraising_status ON ventures(fundraising_status);
CREATE INDEX idx_ventures_technology_layer ON ventures(technology_layer);
CREATE INDEX idx_ventures_origin_type ON ventures(venture_origin_type);
CREATE INDEX idx_ventures_product_modality ON ventures(product_modality);

CREATE INDEX idx_signals_venture ON signals(venture_id);
CREATE INDEX idx_signals_date ON signals(signal_date DESC);

CREATE INDEX idx_founders_repeat ON founders(is_repeat_founder);
CREATE INDEX idx_founders_bigtech ON founders(has_big_tech_background);
CREATE INDEX idx_founders_phd ON founders(has_phd);

CREATE INDEX idx_venture_founders_venture ON venture_founders(venture_id);
CREATE INDEX idx_venture_founders_founder ON venture_founders(founder_id);

CREATE INDEX idx_venture_events_venture ON venture_events(venture_id);
CREATE INDEX idx_venture_events_date ON venture_events(event_date DESC);

CREATE INDEX idx_venture_relationships_child ON venture_relationships(child_venture_id);
CREATE INDEX idx_venture_relationships_parent ON venture_relationships(parent_venture_id);

CREATE INDEX idx_products_venture ON products(venture_id);

CREATE INDEX idx_legal_entities_venture ON legal_entities(venture_id);
CREATE INDEX idx_legal_entities_siren ON legal_entities(siren);

CREATE INDEX idx_tags_venture ON venture_tags(venture_id);

CREATE INDEX idx_profiles_stripe ON profiles(stripe_customer_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture_founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read ventures" ON ventures FOR SELECT USING (true);
CREATE POLICY "Public read founders" ON founders FOR SELECT USING (true);
CREATE POLICY "Public read venture_founders" ON venture_founders FOR SELECT USING (true);
CREATE POLICY "Public read venture_relationships" ON venture_relationships FOR SELECT USING (true);
CREATE POLICY "Public read founder_ventures" ON founder_ventures FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read venture_tags" ON venture_tags FOR SELECT USING (true);

-- Authenticated read (intel/sensitive data)
CREATE POLICY "Auth read signals" ON signals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth read venture_events" ON venture_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth read legal_entities" ON legal_entities FOR SELECT USING (auth.role() = 'authenticated');

-- Profile policies
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users manage own searches" ON saved_searches FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ventures_updated_at
  BEFORE UPDATE ON ventures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
