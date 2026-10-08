#!/bin/sh
# Tests backup.sh and restore.sh against a real PostgreSQL server (CI runs it in the postgres:17-alpine
# image). It creates and drops its own databases, so it needs a user that may create databases and
# the usual PG* variables (PGHOST, PGUSER, PGPASSWORD) pointing at the server.
#   sh deploy/backup/test.sh
set -u
here="$(cd "$(dirname "$0")" && pwd)"
export PGDATABASE=backup_test_source
tmp="$(mktemp -d)"
export BACKUP_DIR="$tmp"
failures=0

# Prints a failed check and counts it.
fail() {
  echo "FAIL: $*"
  failures=$((failures + 1))
}

# Asserts that a command succeeds: expect_ok <description> <command...>
expect_ok() {
  description="$1"; shift
  if "$@" >"$tmp/out" 2>&1; then echo "ok:   $description"; else fail "$description"; sed 's/^/      /' "$tmp/out"; fi
}

# Asserts that a command fails: expect_fail <description> <command...>
expect_fail() {
  description="$1"; shift
  if "$@" >"$tmp/out" 2>&1; then fail "$description (it succeeded)"; else echo "ok:   $description"; fi
}

# Runs SQL in the source database.
sql() {
  psql --no-psqlrc --quiet --dbname "$PGDATABASE" --command "$1"
}

# Number of dumps (not counting failed or safety copies).
dump_count() {
  ls "$tmp"/freesite-*.dump 2>/dev/null | wc -l | tr -d ' '
}

cleanup() {
  dropdb --if-exists "${PGDATABASE}_restore_check" >/dev/null 2>&1
  dropdb --if-exists "$PGDATABASE" >/dev/null 2>&1
  rm -rf "$tmp"
}
trap cleanup EXIT

dropdb --if-exists "$PGDATABASE" && createdb "$PGDATABASE" || { echo "cannot create the test database"; exit 1; }
for table in users courses course_members modules votes vote_changes; do
  sql "create table $table (id serial primary key, note text); insert into $table (note) select 'row' from generate_series(1, 3)"
done

echo "--- one backup round"
expect_ok "a backup round succeeds" sh "$here/backup.sh" --once
[ "$(dump_count)" = "1" ] && echo "ok:   exactly one dump was written" || fail "expected one dump, found $(dump_count)"
[ -f "$tmp/.last-success" ] && echo "ok:   the success time was recorded" || fail "no success time recorded"
ls "$tmp"/*.partial >/dev/null 2>&1 && fail "a partial file was left behind" || echo "ok:   no partial file is left"
expect_ok "the healthcheck passes right after a backup" sh "$here/backup.sh" --healthcheck
dump="$(ls "$tmp"/freesite-*.dump | head -n 1)"

echo "--- restore check"
expect_ok "restore.sh check restores the dump" sh "$here/restore.sh" check "$dump"
sh "$here/restore.sh" check "$dump" >"$tmp/check-output" 2>&1
grep -q "users: 3 rows" "$tmp/check-output" && echo "ok:   the restore has the rows" || fail "the restore does not show 3 users"
psql --no-psqlrc --dbname postgres --tuples-only --no-align --command "select count(*) from pg_database where datname = '${PGDATABASE}_restore_check'" | grep -qx 0 && echo "ok:   the scratch database is gone" || fail "the scratch database was left behind"
expect_ok "restore.sh list shows the dump" sh "$here/restore.sh" list

echo "--- a broken or stale backup is noticed"
head -c 200 "$dump" > "$tmp/truncated.dump"
expect_fail "a truncated dump cannot be restored" sh "$here/restore.sh" check "$tmp/truncated.dump"
expect_fail "a truncated dump fails verification" sh "$here/backup.sh" --verify "$tmp/truncated.dump"
sql "insert into users (note) select 'new' from generate_series(1, 50)"
expect_fail "a dump with too few rows fails verification" sh "$here/backup.sh" --verify "$dump"
echo 0 > "$tmp/.last-success"
expect_fail "the healthcheck fails when the last backup is old" sh "$here/backup.sh" --healthcheck
rm "$tmp/.last-success"
expect_fail "the healthcheck fails when there never was a backup" sh "$here/backup.sh" --healthcheck

echo "--- retention"
old="$tmp/freesite-20200101-010101.dump"; cp "$dump" "$old"; touch -d "2020-01-01 01:01:01" "$old"
day_a="$tmp/freesite-$(date -u -d "@$(( $(date +%s) - 5 * 86400 ))" +%Y%m%d)-010000.dump"
day_b="$tmp/freesite-$(date -u -d "@$(( $(date +%s) - 5 * 86400 ))" +%Y%m%d)-020000.dump"
cp "$dump" "$day_a"; cp "$dump" "$day_b"
expect_ok "a second backup round succeeds" sh "$here/backup.sh" --once
[ -e "$old" ] && fail "a dump older than the retention time was kept" || echo "ok:   dumps past the retention time are deleted"
[ -e "$day_a" ] && fail "an older dump of the same day was kept" || echo "ok:   only the newest dump of an older day is kept (1/2)"
[ -e "$day_b" ] && echo "ok:   only the newest dump of an older day is kept (2/2)" || fail "the newest dump of the older day was deleted"
[ "$(dump_count)" = "3" ] && echo "ok:   recent dumps are all kept" || fail "expected 3 dumps, found $(dump_count)"

echo "--- restoring into the live database"
sql "delete from users"
expect_fail "apply refuses without confirmation" sh "$here/restore.sh" apply "$dump"
expect_fail "apply refuses a broken dump and changes nothing" env RESTORE_CONFIRM="$PGDATABASE" sh "$here/restore.sh" apply "$tmp/truncated.dump"
[ "$(psql --no-psqlrc --dbname "$PGDATABASE" --tuples-only --no-align --command 'select count(*) from users')" = "0" ] && echo "ok:   the live database was untouched by the refused restores" || fail "a refused restore changed the live database"
expect_ok "apply restores the dump" env RESTORE_CONFIRM="$PGDATABASE" sh "$here/restore.sh" apply "$dump"
[ "$(psql --no-psqlrc --dbname "$PGDATABASE" --tuples-only --no-align --command 'select count(*) from users')" = "3" ] && echo "ok:   the live database has the restored rows" || fail "the rows were not restored"
ls "$tmp"/before-restore-*.dump >/dev/null 2>&1 && echo "ok:   the state before the restore was saved" || fail "no safety dump was written"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all backup checks passed"
