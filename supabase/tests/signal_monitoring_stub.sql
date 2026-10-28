-- Minimal stand-in for the production objects the signal monitoring migration
-- references, so it can be tested on a throwaway local Postgres
-- (see run_signal_monitoring_tests.sh). Shapes mirror production (Navigator
-- project) as inspected on 2026-10-27.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TYPE signal_type AS ENUM (
  'hiring_surge', 'new_product', 'pivot', 'expansion', 'partnership', 'award', 'media_mention',
  'regulatory', 'talent_move', 'patent_filing', 'open_source', 'conference', 'other',
  'restructuring', 'fundraising', 'incorporation', 'key_hire', 'founder_departure'
);
CREATE TYPE funding_stage AS ENUM ('pre_seed', 'seed', 'series_a', 'series_b', 'grant', 'other');

CREATE TABLE profiles (id UUID PRIMARY KEY, is_admin BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE organizations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL);
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_type signal_type NOT NULL,
  title TEXT NOT NULL
);

-- Supabase grants table privileges broadly and relies on RLS.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

INSERT INTO organizations (id, name) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Radar App'),
  ('00000000-0000-0000-0000-00000000000b', 'Other Co');
INSERT INTO signals (id, organization_id, signal_type, title) VALUES
  ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-00000000000a', 'fundraising', 'Seed round');
INSERT INTO profiles (id, is_admin) VALUES ('00000000-0000-0000-0000-0000000000ad', true);
