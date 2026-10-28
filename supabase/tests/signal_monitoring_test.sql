-- Assertions for the signal monitoring migration. Each block raises on failure.

DO $$
DECLARE n INT;
BEGIN
  -- A draft can be queued with Claude's proposal and links back to an existing signal.
  INSERT INTO signal_candidates (organization_id, source, source_url, raw_title, signal_type, title, confidence, possible_duplicate_signal_id)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'press_rss', 'https://example.com/a', 'Radar App raises', 'fundraising', 'Raises seed', 0.9,
          '00000000-0000-0000-0000-0000000005a1');
  SELECT count(*) INTO n FROM signal_candidates WHERE status = 'pending';
  IF n <> 1 THEN RAISE EXCEPTION 'expected 1 pending draft, got %', n; END IF;
  RAISE NOTICE 'ok: draft queued as pending';

  -- The same article cannot be queued twice for the same startup...
  BEGIN
    INSERT INTO signal_candidates (organization_id, source, source_url, raw_title, signal_type, title)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'google_news', 'https://example.com/a', 'dup', 'other', 'dup');
    RAISE EXCEPTION 'duplicate URL was accepted';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok: same URL blocked for the same startup';
  END;
  -- ...but can be for a different startup it also mentions.
  INSERT INTO signal_candidates (organization_id, source, source_url, raw_title, signal_type, title)
  VALUES ('00000000-0000-0000-0000-00000000000b', 'press_rss', 'https://example.com/a', 'Other Co too', 'partnership', 'Partners');
  RAISE NOTICE 'ok: same URL allowed for another startup';

  -- Claude's dismissed finds are stored too, so they aren't re-read.
  INSERT INTO signal_candidates (organization_id, source, source_url, raw_title, signal_type, title, status)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'google_news', 'https://example.com/namesake', 'Namesake', 'other', 'Namesake', 'dismissed');
  RAISE NOTICE 'ok: dismissed finds can be stored';

  -- Register events read from Pappers are a source of their own.
  INSERT INTO signal_candidates (organization_id, source, source_url, raw_title, signal_type, title)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'pappers', 'https://www.pappers.fr/entreprise/912345678#actes-2026-10-01', 'Actes', 'other', 'Actes');
  RAISE NOTICE 'ok: pappers drafts accepted';

  -- Values outside the allowed lists are refused.
  BEGIN
    INSERT INTO signal_candidates (organization_id, source, source_url, raw_title, signal_type, title)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'twitter', 'https://example.com/b', 't', 'other', 't');
    RAISE EXCEPTION 'unknown source was accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: unknown source refused';
  END;
  BEGIN
    INSERT INTO signal_candidates (organization_id, source, source_url, raw_title, signal_type, title, strength)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'bodacc', 'https://example.com/c', 't', 'other', 't', 9);
    RAISE EXCEPTION 'strength 9 was accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: strength outside 1-5 refused';
  END;

  -- Deleting the linked signal keeps the draft and clears the link.
  DELETE FROM signals WHERE id = '00000000-0000-0000-0000-0000000005a1';
  SELECT count(*) INTO n FROM signal_candidates WHERE possible_duplicate_signal_id IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'duplicate link not cleared'; END IF;
  RAISE NOTICE 'ok: deleting a signal clears the duplicate link';

  -- Monitoring settings default to enabled with no aliases.
  INSERT INTO monitoring_state (organization_id) VALUES ('00000000-0000-0000-0000-00000000000a');
  SELECT count(*) INTO n FROM monitoring_state WHERE enabled AND search_aliases = '{}' AND exclude_terms = '{}'
    AND last_pappers_at IS NULL AND pappers_seen IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'monitoring_state defaults wrong'; END IF;
  RAISE NOTICE 'ok: monitoring settings default to enabled';

  -- Pappers messages are stored as received; leads hold one row per SIREN.
  INSERT INTO monitoring_inbox (evenement, list_id, payload) VALUES ('notifications.veille', '1', '{"donnees": {}}');
  SELECT count(*) INTO n FROM monitoring_inbox WHERE processed_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'inbox row not stored'; END IF;
  INSERT INTO company_leads (siren, name) VALUES ('882572894', 'HAYDN HARRIS CONSULTING');
  BEGIN
    INSERT INTO company_leads (siren, name) VALUES ('882572894', 'again');
    RAISE EXCEPTION 'duplicate lead accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO company_leads (siren) VALUES ('12345');
    RAISE EXCEPTION 'malformed SIREN accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SELECT count(*) INTO n FROM company_leads WHERE status = 'new';
  IF n <> 1 THEN RAISE EXCEPTION 'lead default status wrong'; END IF;
  RAISE NOTICE 'ok: Pappers messages stored, leads unique per SIREN';

  -- A lead's score stays within 0-100 and its facts default to empty.
  UPDATE company_leads SET score = 72, score_reasons = ARRAY['+20 software'] WHERE siren = '882572894';
  BEGIN
    UPDATE company_leads SET score = 120 WHERE siren = '882572894';
    RAISE EXCEPTION 'score 120 accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SELECT count(*) INTO n FROM company_leads WHERE directors = '[]' AND research IS NULL AND score = 72;
  IF n <> 1 THEN RAISE EXCEPTION 'lead ranking defaults wrong'; END IF;
  RAISE NOTICE 'ok: lead scores kept within 0-100';

  -- Deleting a startup removes its drafts and settings.
  DELETE FROM organizations WHERE id = '00000000-0000-0000-0000-00000000000a';
  SELECT (SELECT count(*) FROM signal_candidates WHERE organization_id = '00000000-0000-0000-0000-00000000000a')
       + (SELECT count(*) FROM monitoring_state WHERE organization_id = '00000000-0000-0000-0000-00000000000a') INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'cascade on startup delete failed'; END IF;
  RAISE NOTICE 'ok: deleting a startup removes its drafts and settings';
END $$;

-- Public roles can see nothing.
SET ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM signal_candidates;
  RAISE EXCEPTION 'anon could read signal_candidates';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anon cannot read drafts';
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM 1 FROM monitoring_state;
  RAISE EXCEPTION 'authenticated could read monitoring_state';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: signed-in users cannot read monitoring settings';
END $$;
DO $$
BEGIN
  PERFORM 1 FROM company_leads;
  RAISE EXCEPTION 'authenticated could read company_leads';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: signed-in users cannot read leads';
END $$;
RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
  INSERT INTO monitoring_inbox (evenement, payload) VALUES ('x', '{}');
  RAISE EXCEPTION 'anon could write to the inbox';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anon cannot write to the Pappers inbox';
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$
BEGIN
  PERFORM 1 FROM monitoring_runs;
  RAISE NOTICE 'ok: service role can read the run log';
END $$;
RESET ROLE;
