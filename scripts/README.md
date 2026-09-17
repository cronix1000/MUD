# DevOps scripts

This directory holds one-shot ops scripts the CI / home server uses. All are
read-only against the source tree; they mutate only the data directory and
container state.

| Script | What it does |
|---|---|
| `split-existing-db.mjs` | One-shot split of a single `mud.db` into `mud.world.db` + `mud.players.db`. Safe to re-run; refuses to overwrite either output file. |
| `safe-db-swap.sh` | On every deploy: snapshot the current world DB, extract `player_*` rows into the players DB, swap in the freshly built world DB. |
| `prune-snapshots.sh` | Keeps the N most recent timestamped `.bak` files in `ModularMudServer/`. Default keeps 10. |
| `migrate.mjs` | Headless migration runner. Honours `MUD_DB_PATH` and `MUD_PLAYERS_DB`. |

## Usage examples

Split your existing single-file DB:

```sh
node scripts/split-existing-db.mjs \
  --server-dir ./ModularMudServer
```

Run pending migrations against a chosen DB path:

```sh
MUD_DB_PATH=./ModularMudServer/mud.world.db \
MUD_PLAYERS_DB=./ModularMudServer/mud.players.db \
node scripts/migrate.mjs --list
```

Prune old DB snapshots:

```sh
./scripts/prune-snapshots.sh 10 ./ModularMudServer
```
