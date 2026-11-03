#!/usr/bin/env bash
# Tests the Early Detection migration on a throwaway local Postgres:
# apply it twice (idempotency), run assertions, roll back, re-apply.
# Usage: supabase/tests/run_early_detection_tests.sh   (needs Postgres 14+ with pg_trgm and unaccent)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../.."
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
data="$(mktemp -d)"
port="${PG_PORT:-54332}"
psql=("$bin/psql" -h "$data" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -X)
export PGOPTIONS="-c client_min_messages=warning"

cleanup() { "$bin/pg_ctl" -D "$data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$data"; }
trap cleanup EXIT

if [ "$(id -u)" = 0 ]; then
  chown -R postgres "$data"
  run() { su postgres -c "$(printf '%q ' "$@")"; }
else
  run() { "$@"; }
fi

run "$bin/initdb" -D "$data" -U postgres -A trust >/dev/null
run "$bin/pg_ctl" -D "$data" -o "-p $port -k $data -c listen_addresses=''" -l "$data/log" start -w >/dev/null

migration="$root/supabase/migrations/20261104_early_detection_foundation.sql"
rollback="$root/supabase/rollbacks/20261104_early_detection_foundation.sql"
history="$root/supabase/migrations/20261105_early_detection_history_state.sql"
history_rollback="$root/supabase/rollbacks/20261105_early_detection_history_state.sql"
brand="$root/supabase/migrations/20261106_project_brand_links.sql"
brand_rollback="$root/supabase/rollbacks/20261106_project_brand_links.sql"
"${psql[@]}" -f "$here/early_detection_stub.sql"

echo "== migrations (twice)"
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$history"
"${psql[@]}" -f "$brand"
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$history"
"${psql[@]}" -f "$brand"
test "$("${psql[@]}" -c "SELECT history_complete FROM detection_sources WHERE slug = 'esr-iphd'" | tr -d ' ')" = f
echo "  history state columns added; i-PhD source starts in history mode"
"${psql[@]}" -c "INSERT INTO projects (name, slug, brand_name, website_url, linkedin_url) VALUES ('T', 'brand-test', 'Izena', 'https://izena.fr/', 'https://www.linkedin.com/company/izena/')" >/dev/null
for bad in "website_url = 'izena.fr'" "website_url = 'javascript:alert(1)'" "linkedin_url = 'https://evil.example/linkedin.com/x'" "linkedin_url = 'http://www.linkedin.com/company/x'" "brand_name = ''"; do
  if "${psql[@]}" -c "UPDATE projects SET $bad WHERE slug = 'brand-test'" 2>/dev/null; then echo "FAIL: accepted $bad"; exit 1; fi
done
"${psql[@]}" -c "DELETE FROM projects WHERE slug = 'brand-test'" >/dev/null
echo "  brand, website and LinkedIn columns accept good links, refuse malformed ones"

echo "== assertions"
PGOPTIONS="-c client_min_messages=notice" "${psql[@]}" -f "$here/early_detection_test.sql" 2>&1 | sed -n "s/^psql:[^ ]* NOTICE:  /  /p; /ERROR/p"; test "${PIPESTATUS[0]}" = 0

echo "== rollback, then re-apply"
"${psql[@]}" -f "$brand_rollback"
test "$("${psql[@]}" -c "SELECT count(*) FROM information_schema.columns WHERE table_name = 'projects' AND column_name IN ('brand_name', 'website_url', 'linkedin_url')" | tr -d ' ')" = 0
"${psql[@]}" -f "$history_rollback"
test "$("${psql[@]}" -c "SELECT count(*) FROM information_schema.columns WHERE column_name IN ('history_complete', 'is_history_import')" | tr -d ' ')" = 0
"${psql[@]}" -f "$rollback"
test "$("${psql[@]}" -c "SELECT count(*) FROM information_schema.tables WHERE table_name IN ('detection_sources', 'detection_candidates', 'source_records', 'projects', 'awards')" | tr -d ' ')" = 0
test "$("${psql[@]}" -c "SELECT count(*) FROM pg_proc WHERE proname LIKE 'detection_match_%'" | tr -d ' ')" = 0
test "$("${psql[@]}" -c "SELECT count(*) FROM people" | tr -d ' ')" = 3
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$history"
"${psql[@]}" -f "$brand"
echo "All Early Detection migration tests passed."
