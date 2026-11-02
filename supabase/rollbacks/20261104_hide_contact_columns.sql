-- Rollback for supabase/migrations/20261104_hide_contact_columns.sql
--
-- Gives anon and authenticated table-wide SELECT on people and organizations
-- again, as it was before the migration. This makes people.email and
-- organizations.email / phone readable with the public anon key again, so
-- only run it if the migration broke something.
--
-- This file lives outside supabase/migrations on purpose so it is never
-- applied automatically.

-- Clears the column-level grants, then restores the table grant.
REVOKE SELECT ON public.people, public.organizations FROM anon, authenticated;
GRANT SELECT ON public.people, public.organizations TO anon, authenticated;
