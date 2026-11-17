-- Minimal stand-ins for the tables the change feed reads, plus Supabase roles.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.organizations (id uuid PRIMARY KEY, name text);
CREATE TABLE IF NOT EXISTS public.signals (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.organization_merge_map (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, source_db text, source_table text, source_id text, notes text, migrated_at timestamptz DEFAULT now(), UNIQUE (source_db, source_table, source_id));
