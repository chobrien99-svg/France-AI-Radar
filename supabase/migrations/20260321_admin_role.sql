-- Admin role for platform owners

ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.is_admin IS 'Set manually in Supabase for platform admin accounts';

-- Index for quick admin checks
CREATE INDEX idx_profiles_is_admin ON profiles (id) WHERE is_admin = true;
