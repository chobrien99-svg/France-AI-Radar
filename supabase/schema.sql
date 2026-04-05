-- ============================================================
-- AI Radar — Unified Database Schema Reference
-- ============================================================
-- This file documents the schema of the central database at
-- oxqpmtttgicvxmesrjzy.supabase.co. Tables are managed there;
-- this file is kept in sync for reference only.
--
-- Last updated: 2026-04-05
-- ============================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE organization_type AS ENUM ('startup', 'investor', 'accelerator', 'corporate', 'government', 'research');
CREATE TYPE organization_status AS ENUM ('active', 'inactive', 'draft', 'archived');
CREATE TYPE fundraising_status_type AS ENUM ('preparing_for_fundraising', 'likely_raising_within_12_months', 'not_currently_raising', 'unknown');
CREATE TYPE technology_layer_type AS ENUM ('perception', 'robotics', 'agent_platform', 'orchestration', 'vertical_ai', 'infrastructure', 'other');
CREATE TYPE subscription_tier AS ENUM ('free', 'explorer', 'professional', 'enterprise');
CREATE TYPE signal_type AS ENUM ('fundraising', 'key_hire', 'restructuring', 'patent_ip', 'pivot', 'product_launch', 'partnership', 'founder_departure', 'advisory_formation', 'incorporation');
CREATE TYPE source_type AS ENUM ('stealth', 'incorporated', 'accelerator', 'incubator', 'france_2030_laureat');
CREATE TYPE verification_status AS ENUM ('unverified', 'verified', 'rejected');
CREATE TYPE alert_type AS ENUM ('all_signals', 'fundraising', 'key_hire', 'custom');

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CORE TABLES
-- ============================================

-- Cities (referenced by organizations.city_id)
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  department TEXT,
  department_code TEXT,
  region TEXT,
  country TEXT NOT NULL DEFAULT 'France',
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cities_slug ON cities (slug);
CREATE INDEX idx_cities_country ON cities (country);

-- Organizations (startups, investors, etc.)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  organization_type organization_type NOT NULL DEFAULT 'startup',
  description TEXT,
  short_description TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  logo_url TEXT,
  status organization_status NOT NULL DEFAULT 'active',
  country TEXT NOT NULL DEFAULT 'France',
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  founded_date DATE,
  employee_count INTEGER,
  employee_range TEXT,
  founded_year INTEGER,
  first_seen_at TIMESTAMPTZ,
  is_stealth BOOLEAN NOT NULL DEFAULT FALSE,
  total_raised_eur NUMERIC(15,2),
  last_round TEXT,
  fundraising_status fundraising_status_type DEFAULT 'unknown',
  technology_layer technology_layer_type,
  signal_count INTEGER DEFAULT 0,
  last_signal_date TIMESTAMPTZ,
  is_public_profile BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status TEXT,
  legacy_source TEXT,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_organizations_slug ON organizations (slug);
CREATE INDEX idx_organizations_type ON organizations (organization_type);
CREATE INDEX idx_organizations_status ON organizations (status);
CREATE INDEX idx_organizations_city ON organizations (city_id);
CREATE INDEX idx_organizations_country ON organizations (country);
CREATE INDEX idx_organizations_name_trgm ON organizations USING gin (name gin_trgm_ops);

-- Organization Profiles (enriched narrative data)
CREATE TABLE organization_profiles (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  what_they_are_building TEXT,
  why_it_matters TEXT,
  investor_brief TEXT,
  analyst_note TEXT,
  product_description TEXT,
  target_market TEXT,
  competitive_landscape TEXT,
  current_strategy TEXT,
  business_model_hypothesis TEXT,
  technical_thesis TEXT,
  fundraising_signal_summary TEXT,
  est_next_raise TEXT,
  entity_complexity TEXT,
  verification_status TEXT,
  legacy_source TEXT,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_org_profiles_org ON organization_profiles (organization_id);

-- Organization Tags (badges/signals on cards)
CREATE TABLE organization_tags (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  strength INTEGER CHECK (strength >= 1 AND strength <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, tag)
);
CREATE INDEX idx_org_tags_org ON organization_tags (organization_id);
CREATE INDEX idx_org_tags_tag ON organization_tags (tag);

-- People (founders, executives, etc.)
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  full_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  email TEXT,
  bio TEXT,
  photo_url TEXT,
  has_phd BOOLEAN NOT NULL DEFAULT FALSE,
  is_repeat_founder BOOLEAN NOT NULL DEFAULT FALSE,
  has_big_tech_background BOOLEAN NOT NULL DEFAULT FALSE,
  big_tech_employer TEXT,
  academic_lab TEXT,
  previous_exits INTEGER DEFAULT 0,
  is_public_profile BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status TEXT,
  legacy_source TEXT,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_people_slug ON people (slug);
CREATE INDEX idx_people_name_trgm ON people USING gin (full_name gin_trgm_ops);

-- Organization ↔ People junction
CREATE TABLE organization_people (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role TEXT,
  title TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  is_founder BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  legacy_source TEXT,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, person_id, role)
);
CREATE INDEX idx_org_people_org ON organization_people (organization_id);
CREATE INDEX idx_org_people_person ON organization_people (person_id);
CREATE INDEX idx_org_people_founder ON organization_people (is_founder) WHERE is_founder = TRUE;

-- Signals (intelligence timeline)
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_type signal_type NOT NULL,
  signal_date DATE,
  strength INTEGER CHECK (strength >= 1 AND strength <= 5),
  title TEXT NOT NULL,
  description TEXT,
  source_type source_type,
  source_name TEXT,
  source_url TEXT,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  legacy_source TEXT,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_signals_org ON signals (organization_id);
CREATE INDEX idx_signals_type ON signals (signal_type);
CREATE INDEX idx_signals_date ON signals (signal_date DESC);

-- ============================================
-- PRODUCT SCOPING
-- ============================================

-- Product Catalog (AI Radar, future products)
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product ↔ Organization junction
CREATE TABLE product_organizations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES product_catalog(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, organization_id)
);
CREATE INDEX idx_prod_orgs_product ON product_organizations (product_id);
CREATE INDEX idx_prod_orgs_org ON product_organizations (organization_id);

-- ============================================
-- ADDITIONAL ENTITY TABLES
-- ============================================

-- Sectors (hierarchical)
CREATE TABLE sectors (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization ↔ Sector junction
CREATE TABLE organization_sectors (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, sector_id)
);

-- Legal Entities (SIREN/SIRET)
CREATE TABLE legal_entities (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  legal_form TEXT,
  siren TEXT,
  siret TEXT,
  capital_eur NUMERIC(15,2),
  incorporation_date DATE,
  registered_city TEXT,
  country TEXT NOT NULL DEFAULT 'France',
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  naf_code TEXT,
  naf_label TEXT,
  verification_status TEXT,
  legacy_source TEXT,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Person Experience
CREATE TABLE person_experience (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  company_name TEXT,
  role TEXT,
  title TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- USER / SUBSCRIPTION TABLES
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_tier subscription_tier DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Watchlist
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);

-- Lists
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- List Items
CREATE TABLE list_items (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notes TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, organization_id)
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved Searches
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Export Usage (monthly CSV export tracking)
CREATE TABLE export_usage (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  export_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period)
);

-- Atomic increment for export usage
CREATE OR REPLACE FUNCTION increment_export_usage(p_user_id UUID, p_period TEXT)
RETURNS INTEGER AS $$
  INSERT INTO export_usage (user_id, period, export_count)
    VALUES (p_user_id, p_period, 1)
  ON CONFLICT (user_id, period)
    DO UPDATE SET export_count = export_usage.export_count + 1
  RETURNING export_count;
$$ LANGUAGE SQL;

-- ============================================
-- ROW-LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_usage ENABLE ROW LEVEL SECURITY;

-- Public read on reference data
CREATE POLICY "Public read organizations" ON organizations FOR SELECT USING (true);
CREATE POLICY "Public read organization_profiles" ON organization_profiles FOR SELECT USING (true);
CREATE POLICY "Public read organization_tags" ON organization_tags FOR SELECT USING (true);
CREATE POLICY "Public read people" ON people FOR SELECT USING (true);
CREATE POLICY "Public read organization_people" ON organization_people FOR SELECT USING (true);
CREATE POLICY "Public read product_catalog" ON product_catalog FOR SELECT USING (true);
CREATE POLICY "Public read product_organizations" ON product_organizations FOR SELECT USING (true);
CREATE POLICY "Public read cities" ON cities FOR SELECT USING (true);

-- Authenticated read on intelligence data
CREATE POLICY "Auth read signals" ON signals FOR SELECT USING (auth.role() = 'authenticated');

-- User-scoped data
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users manage own watchlist" ON watchlist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own lists" ON lists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own list_items" ON list_items FOR ALL
  USING (EXISTS (SELECT 1 FROM lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));
CREATE POLICY "Users manage own alerts" ON alerts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own saved_searches" ON saved_searches FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own export_usage" ON export_usage FOR ALL USING (auth.uid() = user_id);
