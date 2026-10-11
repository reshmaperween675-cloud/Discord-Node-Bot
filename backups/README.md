# Railway Database Backup — 2026-10-11

Full backup of the Railway PostgreSQL database, including schema and data (39 user tables).

## Files
- `railway_backup_20261011.sql` — Plain SQL dump; restore with `psql`.
- `railway_backup_20261011.dump` — PostgreSQL custom-format dump; restore with `pg_restore` (supports parallel restore and selective table restore).

## Restoring to a new PostgreSQL database

Set `DATABASE_URL` to the new database's connection URL, then run one of:

### Option A — plain SQL
```sh
psql "$DATABASE_URL" -f railway_backup_20261011.sql
```

### Option B — custom format
```sh
pg_restore --no-owner --no-privileges -d "$DATABASE_URL" railway_backup_20261011.dump
```

Notes:
- The dump was taken with `--no-owner --no-privileges`, so it can be restored regardless of the destination role names.
- The source server was PostgreSQL 18.6. Use PostgreSQL 18 or newer to avoid version incompatibilities.
- Both files contain full data as of the backup date.
