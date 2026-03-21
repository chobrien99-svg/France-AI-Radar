-- ============================================
-- Founder profile enrichment
-- Adds slug (for routing) and detailed pedigree
-- fields used on the founder bio page.
-- ============================================

ALTER TABLE founders
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS previous_exits TEXT[],
  ADD COLUMN IF NOT EXISTS big_tech_employer TEXT,
  ADD COLUMN IF NOT EXISTS academic_lab TEXT;

-- Generate URL-safe slugs from existing founder names.
-- Format: "Marie Curie" → "marie-curie"
-- Append a short suffix from the UUID if the name slug already exists.
UPDATE founders
SET slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Ensure uniqueness: append first 6 chars of id where there are collisions.
UPDATE founders f
SET slug = f.slug || '-' || substring(f.id::text, 1, 6)
WHERE (
  SELECT count(*)
  FROM founders f2
  WHERE f2.slug = f.slug
) > 1;

-- After back-fill, enforce NOT NULL.
ALTER TABLE founders
  ALTER COLUMN slug SET NOT NULL;

-- Index for fast slug lookups on the founder bio route.
CREATE UNIQUE INDEX IF NOT EXISTS founders_slug_idx ON founders (slug);
