#!/bin/sh
# Restores a backup made by backup.sh.
#
#   restore.sh list          show the available dumps
#   restore.sh check FILE    restore into a scratch database, print the row counts, delete it again;
#                            safe to run at any time, the live database is not touched
#   restore.sh apply FILE    REPLACE the live database with the dump. Stop the backend first, and
#                            set RESTORE_CONFIRM to the database name to confirm. The current state is
#                            saved as before-restore-*.dump first.
#
# See docs/backups.md for the whole procedure.
set -u
. "$(dirname "$0")/common.sh"

command="${1:-}"
file="${2:-}"

# Fails with a message unless the argument names a readable dump.
require_dump() {
  if [ -z "$file" ] || [ ! -r "$file" ]; then
    echo "restore.sh $command needs the path of a dump, e.g. $DIR/$PREFIX-20261001-030000.dump" >&2
    exit 2
  fi
}

case "$command" in
  list)
    ls -lh "$DIR"/"$PREFIX"-*.dump 2>/dev/null || echo "no dumps in $DIR"
    ;;
  check)
    require_dump
    if ! restore_into_scratch "$file"; then
      drop_scratch
      log "ERROR $file could not be restored"
      exit 1
    fi
    for table in $VERIFY_TABLES; do
      echo "$table: $(count_rows "$SCRATCH_DB" "$table") rows"
    done
    drop_scratch
    log "$file can be restored"
    ;;
  apply)
    require_dump
    if [ "${RESTORE_CONFIRM:-}" != "$PGDATABASE" ]; then
      echo "This replaces the database $PGDATABASE with $file." >&2
      echo "Stop the backend first, then run again with RESTORE_CONFIRM=$PGDATABASE." >&2
      exit 2
    fi
    others="$(psql --no-psqlrc --dbname postgres --tuples-only --no-align --command "select count(*) from pg_stat_activity where datname = '$PGDATABASE' and pid <> pg_backend_pid()")"
    if [ "$others" != "0" ] && [ "${RESTORE_FORCE:-}" != "yes" ]; then
      echo "$others other connection(s) to $PGDATABASE are open. Stop the backend, or set RESTORE_FORCE=yes." >&2
      exit 2
    fi
    # The test restore comes first: if the dump is broken, the live database stays untouched.
    if ! restore_into_scratch "$file"; then
      drop_scratch
      log "ERROR $file could not be restored, nothing was changed"
      exit 1
    fi
    drop_scratch
    safety="$DIR/before-restore-$(date -u +%Y%m%d-%H%M%S).dump"
    pg_dump --format=custom --no-owner --no-privileges --dbname "$PGDATABASE" --file "$safety" || { log "ERROR the safety dump failed, nothing was changed"; exit 1; }
    log "saved the current state as $safety"
    psql --no-psqlrc --dbname postgres --command "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$PGDATABASE' and pid <> pg_backend_pid()" >/dev/null
    dropdb "$PGDATABASE" && createdb "$PGDATABASE" && pg_restore --dbname "$PGDATABASE" --no-owner --no-privileges --exit-on-error "$file" || { log "ERROR the restore failed; the previous state is in $safety"; exit 1; }
    log "restored $file into $PGDATABASE; start the backend again"
    ;;
  *)
    echo "usage: restore.sh list | check FILE | apply FILE" >&2
    exit 2
    ;;
esac
