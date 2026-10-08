# Shared by backup.sh and restore.sh. POSIX sh, so it runs under the busybox shell of the
# postgres:alpine image. Connection settings come from the standard libpq variables
# (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).

: "${PGDATABASE:?PGDATABASE must name the database to back up}"

DIR="${BACKUP_DIR:-/backups}"
PREFIX="${BACKUP_PREFIX:-freesite}"
# Tables that must come back from a restore with their rows. Names, not data: nothing here is secret.
VERIFY_TABLES="${BACKUP_VERIFY_TABLES:-users courses course_members modules votes vote_changes}"
SCRATCH_DB="${PGDATABASE}_restore_check"

# Prints a timestamped line, so docker logs show when each step happened.
log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

# Number of rows of a table in a database: count_rows <database> <table>.
count_rows() {
  psql --no-psqlrc --dbname "$1" --tuples-only --no-align --command "select count(*) from \"$2\""
}

# Replaces the scratch database with a restore of a dump file; returns non-zero if anything fails.
restore_into_scratch() {
  dropdb --if-exists "$SCRATCH_DB" || return 1
  createdb "$SCRATCH_DB" || return 1
  pg_restore --dbname "$SCRATCH_DB" --no-owner --no-privileges --exit-on-error "$1"
}

# Removes the scratch database; failures are ignored because there may be nothing to remove.
drop_scratch() {
  dropdb --if-exists "$SCRATCH_DB" >/dev/null 2>&1 || true
}
