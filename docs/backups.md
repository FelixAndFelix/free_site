# Backups

Every instance (production and the dev instance) has its own `backup` service. It needs no setup on
the host: it starts with the rest of the stack.

## What it does

- Writes a compressed dump of the PostgreSQL database (`pg_dump`, custom format) about a minute after it
  starts, and then every 24 hours. Every deploy restarts the stack and so also leaves a fresh dump.
- **Proves each dump can be restored.** Right after writing it, the service restores the dump into a
  scratch database and compares the row counts of the important tables with the live ones. A dump
  that fails is renamed to `*.failed-verification` and the failure is logged.
- Keeps 30 days (`BACKUP_KEEP_DAYS`). Dumps older than two days are thinned out to the newest one per
  day, so many deploys on one day do not pile up.
- Reports its health to Docker: the service is `unhealthy` if the last good backup is older than a day
  plus two hours.

The scripts are in `deploy/backup/` and are tested in CI against the same Postgres image
(`deploy/backup/test.sh`), including broken dumps, stale backups, retention and a restore.

## Where the files are

By default in a Docker volume named `backups` of the compose project. That works out of the box, but the
files are only reachable through Docker. Better: set `BACKUP_DIR` in the instance's env file to an
absolute directory on the host (one directory per instance), so the dumps are ordinary files you can
copy off the machine:

```
BACKUP_DIR=/path/to/backups/freesite
```

Do not put it inside the runner's checkout: the deploy workflow cleans that directory.

List and copy files:

```bash
COMPOSE="docker compose -p free-site --env-file $ENV_FILE -f docker-compose.yml -f docker-compose.prod.yml"
$COMPOSE exec backup sh /scripts/restore.sh list
$COMPOSE cp backup:/backups/FILE.dump .
```

(`$ENV_FILE` is the instance's env file; use project `free-site-dev` and the dev env file for the dev
instance.)

## Keep a copy somewhere else

A backup on the same disk as the database does not survive a dead disk, a stolen server or a deleted
volume. Copy the backup directory to another machine or to cloud storage regularly, e.g. with `rsync`
from a cron job, or with an encrypting tool such as `restic` or `borg`.

The dumps contain everything in the database: email addresses, usernames, password hashes and votes.
Treat them like the database itself: restrictive permissions on the directory, an encrypted disk, and
encrypted off-site copies. The privacy page tells users that deleted data can remain in a backup for up
to 30 days.

## Check that it works

```bash
$COMPOSE ps                      # the backup service should be "healthy"
$COMPOSE logs --tail 30 backup   # one "backup complete" line per round, with the verified row counts
```

Test a restore without touching the live database (safe at any time, worth doing now and then):

```bash
$COMPOSE exec backup sh /scripts/restore.sh check /backups/FILE.dump
```

## Restoring

Use this when data was lost or damaged. It replaces the live database with the dump.

1. Pick the dump (`restore.sh list`) and run the safe check above on it.
2. Stop everything that uses the database: `$COMPOSE stop frontend backend`.
3. Restore. The service first test-restores the dump into a scratch database (a broken dump changes
   nothing), saves the current state as `before-restore-*.dump`, then replaces the database:
   ```bash
   $COMPOSE exec -e RESTORE_CONFIRM=free_site backup sh /scripts/restore.sh apply /backups/FILE.dump
   ```
4. Start the app again: `$COMPOSE start backend frontend`. The backend applies any database migrations
   that are newer than the dump when it starts.
5. **Accounts deleted since the dump are back.** Delete them again, because users are entitled to their
   deletion (a user can do it under Account; otherwise delete the row from `users`, which removes their
   votes and sessions too).

If the database volume itself is gone, start only the database and the backup service
(`$COMPOSE up -d database backup`), then restore as above. The empty database is created on first start.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_DIR` | a Docker volume | Absolute host directory for the dumps |
| `BACKUP_KEEP_DAYS` | `30` | How long dumps are kept |
