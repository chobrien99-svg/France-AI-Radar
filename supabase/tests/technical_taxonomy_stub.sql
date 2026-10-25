-- Minimal stand-in for the production objects the taxonomy migration touches,
-- so it can be tested on a throwaway local Postgres (see run_taxonomy_tests.sh).
-- Shapes mirror production (Navigator project) as inspected on 2026-10-25.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
-- Supabase reads the caller from the JWT; here a session setting stands in.
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TYPE technology_layer_type AS ENUM ('infrastructure', 'model', 'application', 'tooling', 'data', 'other');

CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS
  $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TABLE profiles (id UUID PRIMARY KEY, is_admin BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  technology_layer technology_layer_type
);
CREATE TABLE organization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id),
  technical_thesis TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE product_catalog (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT UNIQUE);
CREATE TABLE product_organizations (
  product_id UUID REFERENCES product_catalog(id),
  organization_id UUID REFERENCES organizations(id)
);

-- Supabase grants table privileges broadly and relies on RLS.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Fixtures: an AI Radar app startup, a non-Radar app company, a Radar infra startup.
INSERT INTO product_catalog (id, slug) VALUES ('00000000-0000-0000-0000-0000000000c1', 'ai-radar');
INSERT INTO organizations (id, name, technology_layer) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Radar App', 'application'),
  ('00000000-0000-0000-0000-00000000000b', 'Marketplace Co', 'application'),
  ('00000000-0000-0000-0000-00000000000c', 'Radar Chips', 'infrastructure'),
  ('00000000-0000-0000-0000-00000000000d', 'Stealth Co', NULL);
INSERT INTO product_organizations (product_id, organization_id) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000d');
INSERT INTO profiles (id, is_admin) VALUES
  ('00000000-0000-0000-0000-0000000000ad', true),
  ('00000000-0000-0000-0000-0000000000ee', false);
