#!/usr/bin/env bash
# Tests the Enterprise API change feed migration on a throwaway local Postgres:
# apply it twice (idempotency), run assertions, roll back, re-apply.
# Usage: supabase/tests/run_api_change_feed_tests.sh   (needs Postgres 14+ binaries)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../.."
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
data="$(mktemp -d)"
port="${PG_PORT:-54331}"
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

migration="$root/supabase/migrations/20261117_api_change_feed.sql"
rollback="$root/supabase/rollbacks/20261117_api_change_feed.sql"
"${psql[@]}" -f "$here/api_change_feed_stub.sql"
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$here/api_change_feed_test.sql"
"${psql[@]}" -f "$rollback"
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$here/api_change_feed_test.sql"
echo "api change feed: migration, rollback and re-apply OK"
