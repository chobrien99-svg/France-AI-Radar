#!/usr/bin/env bash
# Tests the technical taxonomy migration on a throwaway local Postgres:
# apply every taxonomy migration twice (idempotency), run assertions,
# roll back newest first, re-apply.
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
migrations=("$root"/supabase/migrations/2026102*_technical_taxonomy*.sql)
apply_all() { for m in "${migrations[@]}"; do "${psql[@]}" -f "$m"; done; }

echo "== migrations (first run): ${migrations[*]##*/}"
apply_all
echo "== migrations (second run)"
apply_all
echo "== assertions"
PGOPTIONS="-c client_min_messages=notice" "${psql[@]}" -f "$here/technical_taxonomy_test.sql" 2>&1 | sed -n "s/^psql:[^ ]* NOTICE:  /  /p; /ERROR/p"; test "${PIPESTATUS[0]}" = 0
echo "== rollbacks (newest first), then re-apply"
for ((i = ${#migrations[@]} - 1; i >= 0; i--)); do
  "${psql[@]}" -f "$root/supabase/rollbacks/$(basename "${migrations[$i]}")"
done
"${psql[@]}" -c "SELECT 1 FROM organization_profiles LIMIT 0" >/dev/null
apply_all
"${psql[@]}" -tAc "SELECT 'terms after re-apply: ' || count(*) FROM technical_terms"
echo "All taxonomy migration tests passed."
