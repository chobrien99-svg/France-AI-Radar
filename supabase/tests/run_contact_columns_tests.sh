#!/usr/bin/env bash
# Tests the contact-columns migration on a throwaway local Postgres:
# apply it twice (idempotency), run assertions, roll back, re-apply.
# Usage: supabase/tests/run_contact_columns_tests.sh   (needs Postgres 14+ binaries)
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

migration="$root/supabase/migrations/20261104_hide_contact_columns.sql"
rollback="$root/supabase/rollbacks/20261104_hide_contact_columns.sql"
"${psql[@]}" -f "$here/contact_columns_stub.sql"

count() { "${psql[@]}" -c "$1" | tr -d ' '; }
ok() { "${psql[@]}" -c "$1" >/dev/null; }
refused() { if "${psql[@]}" -c "$1" >/dev/null 2>&1; then echo "FAIL: allowed: $1"; exit 1; fi; }

echo "== migration (twice)"
"${psql[@]}" -f "$migration"
"${psql[@]}" -f "$migration"

echo "== assertions"
for role in anon authenticated; do
  refused "SET ROLE $role; SELECT email FROM people"
  refused "SET ROLE $role; SELECT email FROM organizations"
  refused "SET ROLE $role; SELECT phone FROM organizations"
  # No guessing an address through a filter or sort either.
  refused "SET ROLE $role; SELECT id FROM people WHERE email = 'ada@example.com'"
  refused "SET ROLE $role; SELECT id FROM organizations ORDER BY phone"
  # select * includes the hidden columns, so it is refused (callers must list columns).
  refused "SET ROLE $role; SELECT * FROM people"
  refused "SET ROLE $role; SELECT * FROM organizations"
done
echo "  email / phone not readable by anon or authenticated, even via filters"

test "$(count "SET ROLE anon; SELECT count(*) FROM people")" = 1
test "$(count "SET ROLE anon; SELECT full_name FROM people")" = "AdaFounder"
ok "SET ROLE anon; SELECT id, full_name, slug, linkedin_url, bio FROM people"
ok "SET ROLE anon; SELECT id, name, slug, website FROM organizations"
# The account page's embed (watchlist -> organizations) as a signed-in user.
ok "SET ROLE authenticated; SELECT id, name, slug, signal_count, last_signal_date FROM organizations"
echo "  rows and the other columns still readable"

test "$(count "SET ROLE service_role; SELECT email FROM people")" = "ada@example.com"
test "$(count "SET ROLE service_role; SELECT phone FROM organizations")" = "+33100000000"
ok "SET ROLE service_role; SELECT * FROM people"
echo "  service role still reads everything"

test "$(count "SELECT count(*) FROM pg_policies WHERE policyname = 'Public read access' AND tablename IN ('people', 'organizations')")" = 2
"${psql[@]}" -c "SELECT has_table_privilege('anon', 'people', 'INSERT') AND has_table_privilege('authenticated', 'organizations', 'UPDATE')" | grep -q t
echo "  RLS policies and write grants untouched"

# A column added later stays hidden from anon until the migration is re-run.
"${psql[@]}" -c "ALTER TABLE people ADD COLUMN github_url TEXT"
refused "SET ROLE anon; SELECT github_url FROM people"
"${psql[@]}" -f "$migration"
ok "SET ROLE anon; SELECT github_url FROM people"
refused "SET ROLE anon; SELECT email FROM people"
echo "  re-running picks up new columns and still hides email"

echo "== rollback, then re-apply"
"${psql[@]}" -f "$rollback"
test "$(count "SET ROLE anon; SELECT email FROM people")" = "ada@example.com"
ok "SET ROLE authenticated; SELECT * FROM organizations"
"${psql[@]}" -f "$rollback"
"${psql[@]}" -f "$migration"
refused "SET ROLE anon; SELECT email FROM people"
echo "All contact-columns migration tests passed."
