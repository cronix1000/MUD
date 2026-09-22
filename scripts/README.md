# DevOps scripts

This directory holds one-shot ops scripts the CI / home server uses. They
read state from the source tree or remote hosts and mutate only the data
directory, the local Postgres dump directory, or container state.

All MUD services (server, admin, gateway, client) read the world content +
player data from a single Postgres instance configured by `MUD_DATABASE_URL`.
The legacy `mud.world.db` / `mud.players.db` SQLite files are no longer read
by any service at runtime; they exist only as a fallback during the
SQLite-to-Postgres transition window.

| Script | What it does |
|---|---|
| `sqlite-to-pg.mjs` | One-shot import of the legacy `mud.world.db` + `mud.players.db` into the Postgres database referenced by `MUD_DATABASE_URL`. Creates the `world/players/_meta` schemas, copies every row in one transaction, records all 15 known migrations as already applied, runs a row-count parity check. Use at the prod/beta cutover, then delete the SQLite files after 30 days of clean operation. |
| `migrate.mjs` | Headless migration runner against `MUD_DATABASE_URL`. Subcommands: `--list`, `--dry-run`, `--no-backup`, `--skip=1,2,3`. |
| `pg-export.sh` | `pg_dump` the live database (or a given `mud_prod` / `mud_beta` profile) to a `.sql` file. Used by the admin `/admin/_migrate` page to make pre-migration backups. |
| `pg-import.sh` | Replay a `.sql` file into a target Postgres database, refusing to overwrite an existing one without `--force`. |
| `pg-sync-prod-to-beta.sh` | Mirror prod's `world` + `_meta` schemas into beta via `pg_dump` + `psql`. Players data is intentionally not copied. |
| `prune-snapshots.sh` | Keeps the N most recent timestamped `.sql` snapshot files. Default keeps 10. |

## Usage examples

Import an existing SQLite world/players pair into Postgres:

```sh
MUD_DATABASE_URL="postgresql://mud_prod:pw@localhost:5432/mud_prod?options=-c%20search_path=world,players,_meta,public" \
MUD_SQLITE_WORLD=./data/prod/mud.world.db \
MUD_SQLITE_PLAYERS=./data/prod/mud.players.db \
node scripts/sqlite-to-pg.mjs
```

List / run pending migrations against the live Postgres DB:

```sh
MUD_DATABASE_URL=... node scripts/migrate.mjs --list
MUD_DATABASE_URL=... node scripts/migrate.mjs --dry-run
MUD_DATABASE_URL=... node scripts/migrate.mjs
```

Dump / restore a snapshot:

```sh
MUD_PG_URL_MUD_PROD=... bash scripts/pg-export.sh mud_prod ./backups/mud_prod.sql
MUD_PG_URL_MUD_BETA=... bash scripts/pg-import.sh --force mud_beta ./backups/mud_prod.sql
```

Mirror prod world content into beta:

```sh
MUD_PG_URL_PROD=... MUD_PG_URL_BETA=... bash scripts/pg-sync-prod-to-beta.sh
```

Prune old snapshots:

```sh
./scripts/prune-snapshots.sh 10
```
