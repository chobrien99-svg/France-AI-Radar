-- Hide contact details (email, phone) from the public anon key.
--
-- PROPOSAL — not applied. Needs sign-off from whoever owns The Navigator,
-- which shares this database (see "Before applying" below).
--
-- Problem (read-only audit, 2026-11-02): people and organizations have the
-- RLS policy "Public read access" = FOR SELECT USING (true) for every role.
-- The anon key ships to every browser, so anyone can read every row,
-- including people.email (45 filled in) and organizations.email / phone
-- (37 rows).
--
-- Why column grants and not dropping the policy: the Navigator reads these
-- tables directly with the anon key and as signed-in users (API logs,
-- 2026-11-01/02: anon GETs on people, organizations, funding_rounds,
-- programs, program_editions, program_organizations, organization_people).
-- Dropping the policies would empty all of those reads. The Radar itself
-- reads these tables with the service role, except the account page, which
-- embeds organizations(id, name, slug, signal_count, last_signal_date, ...)
-- through watchlist/alerts with the user's session. That keeps working.
--
-- What this does, for anon and authenticated only:
--   * removes table-wide SELECT on people and organizations, then
--   * grants SELECT back on every column except the hidden ones.
-- Rows stay visible (the RLS policy is untouched); the hidden columns can't
-- be selected, filtered on (?email=eq.x) or sorted by. The service role is
-- unaffected. INSERT/UPDATE/DELETE grants are unchanged (RLS still limits
-- writes to admins).
--
-- Side effects to know about:
--   * select=* on these two tables now fails for anon/authenticated
--     ("permission denied for table people"), because * includes the hidden
--     columns. Callers must list their columns. The Navigator does
--     people?select=* and organizations?select=*,... today, so those calls
--     must change BEFORE this is applied.
--   * A column added later is NOT readable by anon/authenticated until this
--     file is run again (it re-grants every current non-hidden column, and is
--     safe to re-run).
--
-- Rollback: supabase/rollbacks/20261104_hide_contact_columns.sql
-- Test:     supabase/tests/run_contact_columns_tests.sh

DO $$
DECLARE
  spec RECORD;
  visible TEXT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('people',        ARRAY['email']),
      ('organizations', ARRAY['email', 'phone'])
    ) AS s(tbl, hidden)
  LOOP
    -- Revoking the table privilege also clears any earlier column grants,
    -- so a re-run starts clean.
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', spec.tbl);

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO visible
    FROM pg_attribute a
    WHERE a.attrelid = format('public.%I', spec.tbl)::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attname <> ALL (spec.hidden);

    EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon, authenticated', visible, spec.tbl);
  END LOOP;
END $$;
