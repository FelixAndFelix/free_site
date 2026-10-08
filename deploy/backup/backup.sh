#!/bin/sh
# Backs up the PostgreSQL database of FreeSite and proves that the backup can be restored.
#
#   backup.sh                run forever: a backup shortly after start, then every BACKUP_INTERVAL_HOURS
#   backup.sh --once         one backup, verification and cleanup, then exit (non-zero on failure)
#   backup.sh --verify FILE  check an existing dump against the live database
#   backup.sh --healthcheck  succeeds while the last good backup is recent enough (for Docker)
#
# Every backup is a pg_dump in custom format (compressed, restorable with pg_restore). Right after
# writing it, the script restores it into a scratch database and compares the row counts of the
# important tables with the live ones, so a backup that cannot be restored is noticed at once.
# Dumps older than BACKUP_KEEP_DAYS are deleted, and dumps older than two days are thinned out to
# the newest one per day. See docs/backups.md.
set -u
. "$(dirname "$0")/common.sh"

KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
INITIAL_DELAY="${BACKUP_INITIAL_DELAY_SECONDS:-60}"
STATUS_FILE="$DIR/.last-success"

# Writes a dump of the live database; prints the file name on success. The file only gets its final
# name once pg_dump has finished, so a crash never leaves something that looks like a backup.
dump_database() {
  final="$DIR/$PREFIX-$(date -u +%Y%m%d-%H%M%S).dump"
  partial="$final.partial"
  if ! pg_dump --format=custom --no-owner --no-privileges --file "$partial"; then
    rm -f "$partial"
    return 1
  fi
  if [ ! -s "$partial" ]; then
    rm -f "$partial"
    return 1
  fi
  mv "$partial" "$final"
  echo "$final"
}

# Restores a dump into the scratch database and checks that the important tables came back with
# their rows. Rows can change while this runs, so the restored count has to lie between the live
# counts from before and after the restore. verify_dump <file> <counts taken before: "table=count ...">
verify_dump() {
  file="$1"
  before="$2"
  if ! pg_restore --list "$file" >/dev/null; then
    log "ERROR the table of contents of $file cannot be read"
    return 1
  fi
  if ! restore_into_scratch "$file"; then
    log "ERROR restoring $file into the scratch database failed"
    drop_scratch
    return 1
  fi
  ok=0
  for table in $VERIFY_TABLES; do
    restored="$(count_rows "$SCRATCH_DB" "$table")" || { log "ERROR table $table is missing in the restore"; ok=1; continue; }
    after="$(count_rows "$PGDATABASE" "$table")"
    was="$(echo "$before" | tr ' ' '\n' | sed -n "s/^$table=//p")"
    low="$was"; high="$after"
    [ "$after" -lt "$was" ] && { low="$after"; high="$was"; }
    if [ "$restored" -lt "$low" ] || [ "$restored" -gt "$high" ]; then
      log "ERROR table $table has $restored rows after the restore but $was before and $after after"
      ok=1
    else
      log "ok    table $table: $restored rows"
    fi
  done
  drop_scratch
  return "$ok"
}

# Live row counts of the important tables as "table=count table=count ...".
live_counts() {
  result=""
  for table in $VERIFY_TABLES; do
    result="$result $table=$(count_rows "$PGDATABASE" "$table")"
  done
  echo "$result"
}

# Deletes dumps older than KEEP_DAYS and keeps only the newest dump per day for days before the
# last two (a deploy restarts this service and so creates a dump, so one day can have several).
clean_up() {
  find "$DIR" -maxdepth 1 -name "$PREFIX-*.dump" -mtime "+$KEEP_DAYS" -exec rm -f {} + 2>/dev/null
  cutoff="$(date -u -d "@$(( $(date +%s) - 2 * 86400 ))" +%Y%m%d)"
  for day in $(ls "$DIR" 2>/dev/null | sed -n "s/^$PREFIX-\([0-9]\{8\}\)-[0-9]\{6\}\.dump$/\1/p" | sort -u); do
    [ "$day" -ge "$cutoff" ] && continue
    ls "$DIR"/"$PREFIX-$day"-*.dump | sort | awk 'NR > 1 { print previous } { previous = $0 }' | while read -r old; do
      rm -f "$old"
    done
  done
}

# One full round: dump, verify, record success, clean up. Returns non-zero if the backup is not good.
run_once() {
  mkdir -p "$DIR"
  before="$(live_counts)" || { log "ERROR cannot read the database"; return 1; }
  file="$(dump_database)" || { log "ERROR pg_dump failed"; return 1; }
  size="$(wc -c < "$file" | tr -d ' ')"
  log "wrote $file ($size bytes)"
  if ! verify_dump "$file" "$before"; then
    mv "$file" "$file.failed-verification"
    log "ERROR the dump did not pass verification and was renamed to $file.failed-verification"
    return 1
  fi
  date +%s > "$STATUS_FILE"
  clean_up
  log "backup complete"
}

# Succeeds if the last good backup is at most one interval plus two hours old.
healthcheck() {
  [ -f "$STATUS_FILE" ] || exit 1
  age=$(( $(date +%s) - $(cat "$STATUS_FILE") ))
  [ "$age" -le $(( INTERVAL_HOURS * 3600 + 7200 )) ]
}

case "${1:-}" in
  --once)
    run_once
    ;;
  --verify)
    [ -n "${2:-}" ] || { echo "usage: backup.sh --verify FILE" >&2; exit 2; }
    verify_dump "$2" "$(live_counts)"
    ;;
  --healthcheck)
    healthcheck
    ;;
  "")
    log "backing up $PGDATABASE to $DIR every $INTERVAL_HOURS hours, keeping $KEEP_DAYS days"
    sleep "$INITIAL_DELAY"
    while true; do
      # A failed round is logged and tried again next time; the healthcheck turns unhealthy meanwhile.
      run_once || log "ERROR backup failed, next try in $INTERVAL_HOURS hours"
      sleep $(( INTERVAL_HOURS * 3600 ))
    done
    ;;
  *)
    echo "usage: backup.sh [--once | --verify FILE | --healthcheck]" >&2
    exit 2
    ;;
esac
