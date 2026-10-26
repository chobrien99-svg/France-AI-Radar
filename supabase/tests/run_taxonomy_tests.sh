#!/usr/bin/env bash
# Tests the technical taxonomy migration on a throwaway local Postgres:
# apply twice (idempotency), run assertions, roll back, re-apply.
# Usage: supabase/tests/run_taxonomy_tests.sh   (needs Postgres 14+ binaries)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../.."
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
data="$(mktemp -d)"
port="${PG_PORT:-54329}"
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

"${psql[@]}" -f "$here/technical_taxonomy_stub.sql"
echo "== migration (first run)"
"${psql[@]}" -f "$root/supabase/migrations/20261025_technical_taxonomy.sql"
echo "== migration (second run)"
"${psql[@]}" -f "$root/supabase/migrations/20261025_technical_taxonomy.sql"
echo "== assertions"
PGOPTIONS="-c client_min_messages=notice" "${psql[@]}" -f "$here/technical_taxonomy_test.sql" 2>&1 | sed -n "s/^psql:[^ ]* NOTICE:  /  /p; /ERROR/p"; test "${PIPESTATUS[0]}" = 0
echo "== rollback, then re-apply"
"${psql[@]}" -f "$root/supabase/rollbacks/20261025_technical_taxonomy.sql"
"${psql[@]}" -c "SELECT 1 FROM organization_profiles LIMIT 0" >/dev/null
"${psql[@]}" -f "$root/supabase/migrations/20261025_technical_taxonomy.sql"
"${psql[@]}" -tAc "SELECT 'layers after re-apply: ' || count(*) FROM technical_layers"
echo "All taxonomy migration tests passed."
