-- Admin-only legal identifiers for French startups
-- Never exposed on public-facing pages or CSV exports

ALTER TABLE startups
  ADD COLUMN siren TEXT,
  ADD COLUMN siret TEXT;

COMMENT ON COLUMN startups.siren IS 'French company SIREN number (9 digits) — admin only';
COMMENT ON COLUMN startups.siret IS 'French establishment SIRET number (14 digits) — admin only';
