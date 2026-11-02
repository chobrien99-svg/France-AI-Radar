-- Minimal stand-in for people and organizations, so the contact-columns
-- migration can be tested on a throwaway local Postgres
-- (see run_contact_columns_tests.sh). Grants and the "Public read access"
-- policy mirror production (Navigator project) as inspected on 2026-11-02;
-- only a few of the real columns are included.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

-- Supabase grants table privileges broadly and relies on RLS.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  slug TEXT,
  linkedin_url TEXT,
  email TEXT,
  bio TEXT
);
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  signal_count INTEGER,
  last_signal_date TIMESTAMPTZ
);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON people FOR SELECT USING (true);
CREATE POLICY "Public read access" ON organizations FOR SELECT USING (true);

INSERT INTO people (full_name, slug, email) VALUES ('Ada Founder', 'ada-founder', 'ada@example.com');
INSERT INTO organizations (name, slug, email, phone, signal_count) VALUES ('Radar App', 'radar-app', 'hello@example.com', '+33 1 00 00 00 00', 3);
