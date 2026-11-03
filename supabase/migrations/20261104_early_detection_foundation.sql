-- Early Detection Engine, Phase 1: the private foundation.
--
-- Sources (e.g. the i-PhD laureates list) are read into immutable records.
-- Records that look relevant become *candidates*: private investigation files
-- an editor reviews in Admin › Candidates. A candidate can be about a research
-- project before any company exists. People and labs named in a source are
-- only *proposed* matches here; nothing is written to the public tables
-- (organizations, people, signals, product_organizations…) by this code.
-- How it works: docs/early-detection.md
--
-- Additive only: no existing table or column is changed.
-- Safe to run twice: IF NOT EXISTS everywhere, ON CONFLICT for the seed row.
-- Every new table is staff-only: RLS on, no policies, anon and authenticated
-- revoked, so only the service-role client (admin API routes, the cron job)
-- can read or write.
-- Rollback: supabase/rollbacks/20261104_early_detection_foundation.sql

-- ------------------------------------------------------------------
-- 1. Source registry and ingestion
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detection_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner TEXT,                         -- who publishes it
  url TEXT,                           -- human-readable page
  access_method TEXT,                 -- e.g. 'Opendatasoft CSV export'
  license TEXT,
  license_url TEXT,
  commercial_use_ok BOOLEAN,          -- NULL = not yet checked
  cadence TEXT,                       -- how often the publisher updates it
  enabled BOOLEAN NOT NULL DEFAULT false,  -- read by the daily job only when true
  cursor JSONB,                       -- where the last successful run stopped
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  consecutive_failures INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES detection_sources(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'cron' CHECK (kind IN ('cron', 'manual', 'backfill')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  cursor_before JSONB,
  cursor_after JSONB,
  fetched INT NOT NULL DEFAULT 0,
  new_records INT NOT NULL DEFAULT 0,
  changed_records INT NOT NULL DEFAULT 0,
  unchanged_records INT NOT NULL DEFAULT 0,
  failed_records INT NOT NULL DEFAULT 0,
  candidates_created INT NOT NULL DEFAULT 0,
  candidates_updated INT NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source ON ingestion_runs (source_id, started_at DESC);

-- One row per version of a source item. A re-run that finds the same content
-- adds nothing (unique key); changed content adds a new version and keeps the old.
CREATE TABLE IF NOT EXISTS source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES detection_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,          -- stable key built by the connector
  content_hash TEXT NOT NULL,         -- sha256 of the normalized payload
  url TEXT,
  title TEXT,
  payload JSONB NOT NULL,             -- the item as published, normalized keys
  event_date DATE,                    -- when the thing happened, if the source says
  edition_year INT,                   -- e.g. award year, when only the year is known
  published_at TIMESTAMPTZ,           -- when the source published it, if known
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- first time we read this version
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- last run that still saw it
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_backfill BOOLEAN NOT NULL DEFAULT false,        -- read during a history import
  run_id UUID REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  -- Set once the candidate step has handled this version (created, updated or
  -- judged not relevant). NULL means a later run tries again.
  processed_at TIMESTAMPTZ,
  UNIQUE (source_id, external_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_source_records_item ON source_records (source_id, external_id, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_records_unprocessed ON source_records (source_id) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS ingestion_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES detection_sources(id) ON DELETE CASCADE,
  run_id UUID REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  external_id TEXT,
  raw JSONB,
  error TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ingestion_failures_open ON ingestion_failures (source_id, created_at DESC) WHERE resolved_at IS NULL;

-- ------------------------------------------------------------------
-- 2. Pre-company projects, awards, external identifiers
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  technical_focus TEXT[] NOT NULL DEFAULT '{}',
  sector TEXT,
  commercialization_status TEXT NOT NULL DEFAULT 'unknown' CHECK (commercialization_status IN
    ('research', 'maturation', 'awarded', 'incorporating', 'incorporated', 'abandoned', 'unknown')),
  -- Set only when an editor links a verified company. Never created automatically.
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  first_evidence_date DATE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  program_edition_id UUID REFERENCES program_editions(id) ON DELETE CASCADE,
  related_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'verified', 'rejected')),
  source_record_id UUID REFERENCES source_records(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(person_id, organization_id, program_edition_id, related_project_id) = 1)
);
CREATE INDEX IF NOT EXISTS idx_project_links_project ON project_links (project_id);

-- Awards, prizes and grants. Kept apart from funding_rounds on purpose:
-- a grant or prize is never an equity round.
CREATE TABLE IF NOT EXISTS awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_type TEXT NOT NULL CHECK (award_type IN ('competition', 'prize', 'grant', 'label', 'fellowship', 'other')),
  title TEXT NOT NULL,
  program_name TEXT,                  -- as the source names it
  program_edition_id UUID REFERENCES program_editions(id) ON DELETE SET NULL,
  category TEXT,                      -- e.g. 'Lauréat - Grand Prix'
  edition_year INT,
  award_date DATE,
  recipient_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  recipient_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  recipient_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  funder_name TEXT,
  funder_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  amount NUMERIC,                     -- only when the source publishes it
  currency TEXT,
  source_record_id UUID REFERENCES source_records(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_awards_project ON awards (recipient_project_id);

CREATE TABLE IF NOT EXISTS external_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'project')),
  entity_id UUID NOT NULL,
  scheme TEXT NOT NULL,               -- orcid, idref, theses_fr, rnsr, ror, openalex, github, siren…
  value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'verified', 'rejected')),
  source_record_id UUID REFERENCES source_records(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scheme, value, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_external_identities_entity ON external_identities (entity_type, entity_id);

-- ------------------------------------------------------------------
-- 3. Candidates: private investigation files
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detection_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('project', 'person', 'company')),
  state TEXT NOT NULL DEFAULT 'new' CHECK (state IN
    ('new', 'under_review', 'watching', 'approved_signal', 'verified_company', 'rejected', 'merged')),
  source_key TEXT NOT NULL UNIQUE,    -- e.g. 'esr-iphd:2025:physicae:julien-mellet'; one candidate per source item
  title TEXT NOT NULL,
  summary TEXT,
  why_surfaced TEXT,
  -- Triage aids, not facts. Kept separate on purpose.
  ai_relevance NUMERIC(3, 2) CHECK (ai_relevance BETWEEN 0 AND 1),
  ai_terms TEXT[] NOT NULL DEFAULT '{}',
  formation_likelihood NUMERIC(3, 2) CHECK (formation_likelihood BETWEEN 0 AND 1),
  evidence_confidence NUMERIC(3, 2) CHECK (evidence_confidence BETWEEN 0 AND 1),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  merged_into_id UUID REFERENCES detection_candidates(id) ON DELETE SET NULL,
  is_backfill BOOLEAN NOT NULL DEFAULT false,   -- found during a history import, not new news
  first_evidence_date DATE,
  last_evidence_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_detection_candidates_queue ON detection_candidates (state, is_backfill, created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES detection_candidates(id) ON DELETE CASCADE,
  source_record_id UUID NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  -- Copies of the same announcement (mirrors, syndication) share a family,
  -- so they count once as independent evidence.
  evidence_family TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_candidate_evidence_record ON candidate_evidence (source_record_id);

-- People, labs and institutions a source names. Private until an editor
-- confirms a match; unmatched people never reach the public people table here.
CREATE TABLE IF NOT EXISTS candidate_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES detection_candidates(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('person', 'lab', 'institution', 'support', 'company')),
  proposed_name TEXT NOT NULL,
  proposed_affiliation TEXT,
  identifiers JSONB NOT NULL DEFAULT '{}',      -- e.g. {"theses_fr": "s369620", "rnsr": "199311991U"}
  match_options JSONB NOT NULL DEFAULT '[]',    -- [{id, kind, name, slug, score, basis}], best first
  matched_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  matched_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'unmatched', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_subjects_candidate ON candidate_subjects (candidate_id);

-- Audit trail: every system and editor action on a candidate.
CREATE TABLE IF NOT EXISTS candidate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES detection_candidates(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,   -- NULL = the system
  action TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  note TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_events_candidate ON candidate_events (candidate_id, created_at);

-- ------------------------------------------------------------------
-- 4. updated_at triggers (reuses the existing function)
-- ------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['detection_sources', 'projects', 'detection_candidates'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_updated_at') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t || '_updated_at', t);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------
-- 5. Name matching for identity proposals (server only)
-- Accent- and case-insensitive trigram similarity. Returns suggestions;
-- an editor decides.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detection_match_people(p_name TEXT, p_limit INT DEFAULT 5)
RETURNS TABLE (id UUID, full_name TEXT, slug TEXT, score REAL)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT p.id, p.full_name, p.slug,
         public.similarity(lower(public.unaccent(p.full_name)), lower(public.unaccent(p_name))) AS score
  FROM public.people p
  WHERE lower(public.unaccent(p.full_name)) OPERATOR(public.%) lower(public.unaccent(p_name))
  ORDER BY score DESC, p.full_name
  LIMIT greatest(1, least(p_limit, 20));
$$;

CREATE OR REPLACE FUNCTION public.detection_match_organizations(p_name TEXT, p_types TEXT[] DEFAULT NULL, p_limit INT DEFAULT 5)
RETURNS TABLE (id UUID, name TEXT, slug TEXT, organization_type TEXT, score REAL)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT o.id, o.name, o.slug, o.organization_type::text,
         public.similarity(lower(public.unaccent(o.name)), lower(public.unaccent(p_name))) AS score
  FROM public.organizations o
  WHERE lower(public.unaccent(o.name)) OPERATOR(public.%) lower(public.unaccent(p_name))
    AND (p_types IS NULL OR o.organization_type::text = ANY (p_types))
  ORDER BY score DESC, o.name
  LIMIT greatest(1, least(p_limit, 20));
$$;

REVOKE EXECUTE ON FUNCTION public.detection_match_people(TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detection_match_organizations(TEXT, TEXT[], INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detection_match_people(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.detection_match_organizations(TEXT, TEXT[], INT) TO service_role;

-- ------------------------------------------------------------------
-- 6. Staff-only: RLS on and no policies
-- ------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'detection_sources', 'ingestion_runs', 'source_records', 'ingestion_failures',
    'projects', 'project_links', 'awards', 'external_identities',
    'detection_candidates', 'candidate_evidence', 'candidate_subjects', 'candidate_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------------
-- 7. First source: i-PhD laureates. Off until an admin switches it on.
-- ------------------------------------------------------------------
INSERT INTO detection_sources (slug, name, owner, url, access_method, license, license_url, commercial_use_ok, cadence, notes)
VALUES (
  'esr-iphd',
  'i-PhD innovation competition laureates',
  'Ministère de l''Enseignement supérieur, de la Recherche et de l''Espace (with Bpifrance)',
  'https://data.enseignementsup-recherche.gouv.fr/explore/assets/fr-esr-laureats-concours-i-phd/',
  'Opendatasoft CSV export (full file, about 300 rows)',
  'Licence Ouverte / Open Licence 2.0 (Etalab)',
  'https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
  true,
  'Yearly, after each edition (last update seen: September 2026)',
  'PhD students and young doctors planning a deeptech startup. Pre-company by definition. Also mirrored on data.gouv.fr (dataset 610219d02cc8bb8ce8042cfd).'
)
ON CONFLICT (slug) DO NOTHING;
