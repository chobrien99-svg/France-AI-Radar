#!/usr/bin/env bash
# Tests the signal monitoring migration on a throwaway local Postgres:
# apply it twice (idempotency), run assertions, roll back, re-apply.
# Usage: supabase/tests/run_signal_monitoring_tests.sh   (needs Postgres 14+ binaries)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../.."
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
data="$(mktemp -d)"
port="${PG_PORT:-54330}"
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

migration="$root/supabase/migrations/20261028_signal_monitoring.sql"
pappers="$root/supabase/migrations/20261029_pappers_monitoring.sql"
"${psql[@]}" -f "$here/signal_monitoring_stub.sql"

echo "== migrations (first run)"
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$pappers"
echo "== migrations (second run)"
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$pappers"
echo "== assertions"
PGOPTIONS="-c client_min_messages=notice" "${psql[@]}" -f "$here/signal_monitoring_test.sql" 2>&1 | sed -n "s/^psql:[^ ]* NOTICE:  /  /p; /ERROR/p"; test "${PIPESTATUS[0]}" = 0
echo "== Pappers rollback, then re-apply"
"${psql[@]}" -c "INSERT INTO signal_candidates (organization_id, source, source_url, raw_title, signal_type, title) VALUES ('00000000-0000-0000-0000-00000000000b', 'pappers', 'https://www.pappers.fr/entreprise/912345678#x', 't', 'other', 't')"
"${psql[@]}" -f "$root/supabase/rollbacks/20261029_pappers_monitoring.sql"
test "$("${psql[@]}" -c "SELECT count(*) FROM information_schema.columns WHERE table_name = 'monitoring_state' AND column_name LIKE '%pappers%'" | tr -d ' ')" = 0
"${psql[@]}" -f "$pappers"
echo "== rollback, then re-apply"
"${psql[@]}" -f "$root/supabase/rollbacks/20261028_signal_monitoring.sql"
"${psql[@]}" -c "SELECT 1 FROM signals LIMIT 0" >/dev/null
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$pappers"
echo "All signal monitoring migration tests passed."
