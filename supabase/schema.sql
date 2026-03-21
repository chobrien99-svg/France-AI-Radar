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
  'advisory_formation', 'incorporation'
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
  first_seen_date DATE DEFAULT CURRENT_DATE,
  investor_brief TEXT,
  product_description TEXT,
  target_market TEXT,
  competitive_landscape TEXT,
  total_raised_eur NUMERIC,
  last_round TEXT,
  est_next_raise TEXT,
  funding_notes TEXT,
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
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  bio TEXT,
  founder_signals founder_signal_type[],
  linkedin_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SIGNALS
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
-- STARTUP BADGES
-- ============================================

CREATE TABLE startup_badges (
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
CREATE INDEX idx_signals_startup ON signals(startup_id);
CREATE INDEX idx_signals_date ON signals(signal_date DESC);
CREATE INDEX idx_founders_startup ON founders(startup_id);
CREATE INDEX idx_badges_startup ON startup_badges(startup_id);
CREATE INDEX idx_profiles_stripe ON profiles(stripe_customer_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read startups" ON startups FOR SELECT USING (true);
CREATE POLICY "Public read founders" ON founders FOR SELECT USING (true);
CREATE POLICY "Public read badges" ON startup_badges FOR SELECT USING (true);
CREATE POLICY "Auth read signals" ON signals FOR SELECT USING (auth.role() = 'authenticated');
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
