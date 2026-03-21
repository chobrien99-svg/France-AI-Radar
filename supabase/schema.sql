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

CREATE TYPE startup_origin_type AS ENUM (
  'new_startup', 'founder_reboot', 'research_spinout',
  'consultancy_evolution', 'venture_studio_launch'
);

CREATE TYPE technology_stage_type AS ENUM (
  'concept', 'prototype', 'pilot', 'production'
);

CREATE TYPE fundraising_status_type AS ENUM (
  'preparing_for_fundraising', 'likely_raising_within_12_months',
  'not_currently_raising', 'unknown'
);

CREATE TYPE startup_relationship_type AS ENUM (
  'founded_by_previous_company', 'technology_spinout', 'reboot_of',
  'pivot_from', 'asset_transfer'
);

CREATE TYPE signal_source_type AS ENUM (
  'stealth',
  'incorporated',
  'accelerator',
  'incubator',
  'france_2030_laureat'
);

-- ============================================
-- STARTUPS
-- ============================================

CREATE TABLE startups (
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

  -- Startup origin
  startup_origin_type startup_origin_type DEFAULT 'new_startup',

  -- Fundraising
  total_raised_eur NUMERIC,
  last_round TEXT,
  est_next_raise TEXT,
  funding_notes TEXT,
  fundraising_status fundraising_status_type DEFAULT 'unknown',
  fundraising_signal_summary TEXT,

  -- Signal provenance
  signal_source signal_source_type,

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
-- STARTUP FOUNDERS  (junction: startups ↔ founders)
-- ============================================

CREATE TABLE startup_founders (
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  founder_id UUID REFERENCES founders(id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (startup_id, founder_id)
);

-- ============================================
-- STARTUP RELATIONSHIPS  (company lineage)
-- ============================================

CREATE TABLE startup_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_startup_id UUID REFERENCES startups(id) ON DELETE SET NULL,
  child_startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  relationship_type startup_relationship_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOUNDER STARTUPS  (founder history outside current startups)
-- ============================================

CREATE TABLE founder_startups (
  founder_id UUID REFERENCES founders(id) ON DELETE CASCADE,
  startup_name TEXT NOT NULL,
  role TEXT,
  start_year INT,
  end_year INT,
  outcome TEXT,
  PRIMARY KEY (founder_id, startup_name)
);

-- ============================================
-- STARTUP EVENTS  (major dated milestones)
-- ============================================

CREATE TABLE startup_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
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
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
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
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
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
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
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
-- STARTUP TAGS  (formerly startup_badges)
-- ============================================

CREATE TABLE startup_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
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
-- WATCHLIST  (saved startups per user)
-- ============================================

CREATE TABLE watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, startup_id)
);

-- ============================================
-- LISTS  (user-curated startup collections)
-- ============================================

CREATE TABLE lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE list_items (
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (list_id, startup_id)
);

-- ============================================
-- ALERTS  (signal notifications per startup)
-- ============================================

CREATE TABLE alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE NOT NULL,
  alert_types TEXT[] DEFAULT '{"any"}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, startup_id)
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

CREATE INDEX idx_startups_sector ON startups(sector);
CREATE INDEX idx_startups_stage ON startups(stage);
CREATE INDEX idx_startups_city ON startups(city);
CREATE INDEX idx_startups_last_signal ON startups(last_signal_date DESC);
CREATE INDEX idx_startups_first_seen ON startups(first_seen_at DESC);
CREATE INDEX idx_startups_fundraising_status ON startups(fundraising_status);
CREATE INDEX idx_startups_technology_layer ON startups(technology_layer);
CREATE INDEX idx_startups_origin_type ON startups(startup_origin_type);
CREATE INDEX idx_startups_product_modality ON startups(product_modality);
CREATE INDEX idx_startups_signal_source ON startups(signal_source);

CREATE INDEX idx_signals_startup ON signals(startup_id);
CREATE INDEX idx_signals_date ON signals(signal_date DESC);

CREATE INDEX idx_founders_repeat ON founders(is_repeat_founder);
CREATE INDEX idx_founders_bigtech ON founders(has_big_tech_background);
CREATE INDEX idx_founders_phd ON founders(has_phd);

CREATE INDEX idx_startup_founders_startup ON startup_founders(startup_id);
CREATE INDEX idx_startup_founders_founder ON startup_founders(founder_id);

CREATE INDEX idx_startup_events_startup ON startup_events(startup_id);
CREATE INDEX idx_startup_events_date ON startup_events(event_date DESC);

CREATE INDEX idx_startup_relationships_child ON startup_relationships(child_startup_id);
CREATE INDEX idx_startup_relationships_parent ON startup_relationships(parent_startup_id);

CREATE INDEX idx_products_startup ON products(startup_id);

CREATE INDEX idx_legal_entities_startup ON legal_entities(startup_id);
CREATE INDEX idx_legal_entities_siren ON legal_entities(siren);

CREATE INDEX idx_tags_startup ON startup_tags(startup_id);

CREATE INDEX idx_profiles_stripe ON profiles(stripe_customer_id);

CREATE INDEX idx_watchlist_user ON watchlist(user_id);
CREATE INDEX idx_watchlist_startup ON watchlist(startup_id);

CREATE INDEX idx_lists_user ON lists(user_id);
CREATE INDEX idx_list_items_list ON list_items(list_id);
CREATE INDEX idx_list_items_startup ON list_items(startup_id);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_startup ON alerts(startup_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read startups" ON startups FOR SELECT USING (true);
CREATE POLICY "Public read founders" ON founders FOR SELECT USING (true);
CREATE POLICY "Public read startup_founders" ON startup_founders FOR SELECT USING (true);
CREATE POLICY "Public read startup_relationships" ON startup_relationships FOR SELECT USING (true);
CREATE POLICY "Public read founder_startups" ON founder_startups FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read startup_tags" ON startup_tags FOR SELECT USING (true);

-- Authenticated read (intel/sensitive data)
CREATE POLICY "Auth read signals" ON signals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth read startup_events" ON startup_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth read legal_entities" ON legal_entities FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist" ON watchlist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own lists" ON lists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own list items" ON list_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM lists WHERE lists.id = list_id AND lists.user_id = auth.uid())
  );
CREATE POLICY "Users manage own alerts" ON alerts FOR ALL USING (auth.uid() = user_id);

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

CREATE TRIGGER startups_updated_at
  BEFORE UPDATE ON startups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
