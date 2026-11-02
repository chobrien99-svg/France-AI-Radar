#!/usr/bin/env bash
# Tests the signal alert deliveries migration on a throwaway local Postgres:
# apply it twice (idempotency), run assertions, roll back, re-apply.
# Usage: supabase/tests/run_signal_alerts_tests.sh   (needs Postgres 14+ binaries)
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

migration="$root/supabase/migrations/20261103_signal_alert_deliveries.sql"
rollback="$root/supabase/rollbacks/20261103_signal_alert_deliveries.sql"
# The signal monitoring stub has the profiles, organizations and signals this needs.
"${psql[@]}" -f "$here/signal_monitoring_stub.sql"

user="00000000-0000-0000-0000-0000000000ad"
signal="00000000-0000-0000-0000-0000000005a1"
org="00000000-0000-0000-0000-00000000000a"
insert="INSERT INTO alert_deliveries (user_id, signal_id, organization_id) VALUES ('$user', '$signal', '$org')"
count() { "${psql[@]}" -c "$1" | tr -d ' '; }

echo "== migration (twice)"
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$migration"

echo "== assertions"
"${psql[@]}" -c "$insert"
# A signal is recorded once per user.
if "${psql[@]}" -c "$insert" 2>/dev/null; then echo "FAIL: duplicate delivery accepted"; exit 1; fi
echo "  one delivery per user and signal"
# Public roles can't read it, even if a broad default grant exists.
if "${psql[@]}" -c "SET ROLE anon; SELECT * FROM alert_deliveries" 2>/dev/null; then echo "FAIL: anon can read"; exit 1; fi
if "${psql[@]}" -c "SET ROLE authenticated; SELECT * FROM alert_deliveries" 2>/dev/null; then echo "FAIL: authenticated can read"; exit 1; fi
echo "  not readable by anon or authenticated"
test "$(count "SET ROLE service_role; SELECT count(*) FROM alert_deliveries")" = 1
echo "  readable by the service role"
# Deleting the signal removes its delivery record.
"${psql[@]}" -c "DELETE FROM signals WHERE id = '$signal'"
test "$(count "SELECT count(*) FROM alert_deliveries")" = 0
echo "  removed with its signal"

echo "== rollback, then re-apply"
"${psql[@]}" -f "$rollback"
test "$(count "SELECT count(*) FROM information_schema.tables WHERE table_name = 'alert_deliveries'")" = 0
"${psql[@]}" -c "SELECT 1 FROM signals LIMIT 0" >/dev/null
"${psql[@]}" -f "$migration"
echo "All signal alert migration tests passed."
