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

CREATE INDEX idx_watchlist_user ON watchlist(user_id);
CREATE INDEX idx_watchlist_startup ON watchlist(startup_id);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own watchlist" ON watchlist FOR ALL USING (auth.uid() = user_id);

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

CREATE INDEX idx_lists_user ON lists(user_id);
CREATE INDEX idx_list_items_list ON list_items(list_id);
CREATE INDEX idx_list_items_startup ON list_items(startup_id);

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lists" ON lists
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own list items" ON list_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lists WHERE lists.id = list_id AND lists.user_id = auth.uid()
    )
  );

-- ============================================
-- ALERTS  (signal notifications per startup)
-- ============================================

CREATE TABLE alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE NOT NULL,
  -- Which signal types trigger this alert; '{"any"}' means all
  alert_types TEXT[] DEFAULT '{"any"}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, startup_id)
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_startup ON alerts(startup_id);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alerts" ON alerts FOR ALL USING (auth.uid() = user_id);
