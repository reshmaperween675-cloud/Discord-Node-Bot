# Railway Database Backup — 2026-07-11

Backup of the "railway" Postgres database (34 tables: leveling, LOWO settings, economy, moderation, tournaments, etc).

## Files
- `railway_backup_20260711.sql` — Plain SQL dump (schema + data). Human-readable, restore with `psql`.
- `railway_backup_20260711.dump` — Custom-format compressed dump. Restore with `pg_restore` (supports parallel restore, selective table restore).

## Restoring to a new Railway (or any) Postgres database

Get your new database's connection URL, then run ONE of:

### Option A — plain SQL (simplest)
```
psql "postgresql://USER:PASS@HOST:PORT/DBNAME" -f railway_backup_20260711.sql
```

### Option B — custom format (recommended, faster, supports -j parallel jobs)
```
pg_restore --no-owner --no-privileges -d "postgresql://USER:PASS@HOST:PORT/DBNAME" railway_backup_20260711.dump
```

Notes:
- The dump was taken with `--no-owner --no-privileges`, so it will apply cleanly regardless of the new database's role names.
- The source server was PostgreSQL 18.4. If your new database is an older major version, restoring may hit incompatibilities — use a Postgres 18+ target if possible.
- Both files contain full data (not just schema) as of the dump time above.
