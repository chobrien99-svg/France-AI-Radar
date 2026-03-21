-- Add contact and web presence fields to startups

ALTER TABLE startups
  ADD COLUMN contact_email TEXT,
  ADD COLUMN contact_phone TEXT,
  ADD COLUMN website_url   TEXT,
  ADD COLUMN linkedin_url  TEXT;

COMMENT ON COLUMN startups.contact_email IS 'Primary contact email for the startup (analyst-sourced)';
COMMENT ON COLUMN startups.contact_phone IS 'Contact phone number';
COMMENT ON COLUMN startups.website_url   IS 'Company website URL';
COMMENT ON COLUMN startups.linkedin_url  IS 'Company LinkedIn profile URL';
