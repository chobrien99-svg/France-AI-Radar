-- Minimal stand-in for the production objects the Early Detection migration
-- references, so it can be tested on a throwaway local Postgres
-- (see run_early_detection_tests.sh). Shapes mirror production (Navigator
-- project) as inspected on 2026-11-03: pg_trgm and unaccent live in public.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE EXTENSION pg_trgm SCHEMA public;
CREATE EXTENSION unaccent SCHEMA public;

CREATE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TYPE organization_type AS ENUM ('startup', 'corporate', 'investor', 'accelerator', 'incubator', 'university', 'research_lab', 'public_agency', 'nonprofit', 'media', 'other');
CREATE TABLE profiles (id UUID PRIMARY KEY, is_admin BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE organizations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, organization_type organization_type NOT NULL DEFAULT 'startup');
CREATE TABLE people (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), full_name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE);
CREATE TABLE programs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL);
CREATE TABLE program_editions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), program_id UUID NOT NULL REFERENCES programs(id), year INT);

-- Supabase grants table privileges broadly and relies on RLS.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

INSERT INTO organizations (id, name, slug, organization_type) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Institut des systèmes intelligents et de robotique', 'isir', 'research_lab'),
  ('00000000-0000-0000-0000-00000000000b', 'Robotique Intelligente SAS', 'robotique-intelligente', 'startup');
INSERT INTO people (id, full_name, slug) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'Hélène Durand', 'helene-durand'),
  ('00000000-0000-0000-0000-0000000000c2', 'Helene Durand-Petit', 'helene-durand-petit'),
  ('00000000-0000-0000-0000-0000000000c3', 'Marc Lefebvre', 'marc-lefebvre');
INSERT INTO profiles (id, is_admin) VALUES ('00000000-0000-0000-0000-0000000000ad', true);
