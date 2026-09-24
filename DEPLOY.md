# Deploy runbook

Two production-grade Linux hosts. Each runs the **same** `docker-compose.yml`
under a different profile (`prod` or `beta`). GitHub Actions builds the
images, then deploys them via SSH. **prod and beta live on different
physical hosts**, each with its own `data/{prod,beta}/` tree and its own
players DB. World content is authored only on prod.

## Topology

```
                         ┌──────────────────────┐
                         │  GitHub Actions      │
                         │  build.yml           │
                         │  deploy-prod.yml     │
                         └──────────┬───────────┘
                                    │ build images
                                    │ push to GHCR
                                    ▼
                   ghcr.io/cronix1000/mud-{server,gateway,admin,client}:TAG
                                   ▲    ▲
             pull :prod ──────────┘    └───── pull :beta
                 │                                │
        ┌───────▼─────────┐             ┌───────▼─────────┐
        │  prod host      │             │  beta host      │
        │  Linux          │  ── ssh ──▶ │  Linux          │
        │  --profile prod │             │  --profile beta │
        │  data/prod/     │   sync over │  data/beta/     │
        │  ports: 80/443  │  scp from   │  ports: 18080   │
        └─────────────────┘   prod host └─────────────────┘
                  │                                │
         live players                    QA / demo players
         world authored here              world mirrored on demand
```

World content lives only on prod. Beta is a QA mirror; on a fresh push it
is refreshed via `scripts/sync-prod-to-beta.sh`, which `scp`s prod's
`data/prod/mud.world.db` to the beta host, scrubs the `_migrations` table
so beta re-runs migrations from scratch, and restarts `mud-server-beta`.
Players DBs are separate per host and never copied.

## Data layout on each host

| Host | Path | Mounted at container |
|---|---|---|
| prod | `~/mud/data/prod/mud.world.db`   | `/data/mud.world.db`   (RW for mud-server, RO for mud-admin) |
| prod | `~/mud/data/prod/mud.players.db` | `/data/mud.players.db` (server only) |
| beta | `~/mud/data/beta/mud.world.db`   | `/data/mud.world.db`   (RW for mud-server-beta, RO for mud-admin-beta) |
| beta | `~/mud/data/beta/mud.players.db` | `/data/mud.players.db` (server only) |
| beta | `~/mud/data/beta/_snapshots/`    | not mounted (host-only rollback target) |
| prod | `~/mud/data/prod/_snapshots/`    | not mounted (host-only rollback target) |

The compose file does **not** declare any DB-related named volumes; the
`./data/{prod,beta}/` bind mounts are the only place SQLite files live.
The remaining named volumes (`caddy-data`, `caddy-config`) are Caddy's
cert cache and have nothing to do with game DBs.

## One-time host setup

### On the prod host (canonical world authoring)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exec sudo -u $USER -- bash -l

mkdir -p ~/mud && cd ~/mud
git clone git@github.com:cronix1000/MUD.git .
chmod +x scripts/*.sh

cp docker/.env.example .env
$EDITOR .env                  # set DOMAIN, REGISTRY, TAG=prod, etc.

mkdir -p data/prod

# Seed data/prod/ from the checked-in split DBs the repo ships with.
# This is the only path that needs a "fresh bootstrap" copy step;
# afterward prod evolves entirely via migrations.
cp ModularMudServer/mud.world.db   data/prod/mud.world.db
cp ModularMudServer/mud.players.db data/prod/mud.players.db

docker compose --profile prod pull || true
docker compose --profile prod up -d
```

After this, prod is running. From here forward:

- **World content changes** arrive by either hand-written migration in
  `MudAdmin/server/utils/migrate.ts` (committed) **or** live edits in the
  prod admin UI at `https://<DOMAIN>/admin` (uncommitted, no migration
  trail). Both are valid; see [Authoring workflow](#authoring-workflow).
- `~/mud/data/prod/_snapshots/` accumulates timestamped `.bak` files via
  `scripts/safe-db-swap.sh` if you wire it into deploy (optional).

### On the beta host (QA mirror)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exec sudo -u $USER -- bash -l

mkdir -p ~/mud && cd ~/mud
git clone git@github.com:cronix1000/MUD.git .
chmod +x scripts/*.sh

cp docker/.env.example .env
$EDITOR .env   # set BETA_*, set TAG=beta, plus:
               # SYNC_HOST=mud@<prod-host>
               # SYNC_REMOTE_SRC=/home/mud/data/prod/mud.world.db

# Bootstrap data/beta/ from the checked-in split DBs (one time only).
bash scripts/reseed-beta.sh

docker compose --profile beta pull || true
docker compose --profile beta up -d
```

Beta is now running with demo data. To refresh beta so its world matches
prod's current state before a QA session:

```bash
bash scripts/sync-prod-to-beta.sh
```

This requires the SSH key referenced by `SYNC_HOST` to already authorize
logins on the prod host (provision via the deploy-prod workflow's
`PROD_SSH_KEY` secret or equivalent).

## Authoring workflow

Two paths exist for changing `world_*` rows. Pick the one that fits.

### Live edit (prod `/admin` UI)

Open `https://<DOMAIN>/admin`. Save a row. Done.

- Fastest.
- No migration trail. The change sits only in `data/prod/mud.world.db`.
- Disaster recovery relies on `_snapshots/` (see Rollback below).
- Suitable for fast iteration, in-progress region builds, demo content.

### Audited edit (migration in `MudAdmin/server/utils/migrate.ts`)

Hand-write the SQL, append a version to the `MIGRATIONS` array, commit:

```ts
{
  version: N,
  name: 'add_<thing>',
  sql: [ `ALTER TABLE world_… ADD COLUMN …` ],
}
```

Push to `main`. CI builds images. Then on the prod host:

```bash
docker compose --profile prod run --rm mud-admin \
  node scripts/migrate.mjs --list       # review pending
docker compose --profile prod run --rm mud-admin \
  node scripts/migrate.mjs --no-backup # actually apply
```

Migrations back up the destination DB to `mud.world.db.bak.<ISO>` before
applying. To test the same migration against prod-shaped data first:

```bash
# On beta host: mirror prod, then run the migration against beta.
bash scripts/sync-prod-to-beta.sh
docker compose --profile beta run --rm mud-admin \
  node scripts/migrate.mjs --no-backup
```

If it works on beta, repeat against prod.

### Beta is read-only by convention

Do **not** edit `world_*` rows in beta's admin UI. The next
`sync-prod-to-beta.sh` overwrites the world DB. Players and accounts are
preserved (different DB, untouched).

## GitHub repo secrets (per environment)

Set under **Settings → Secrets and variables → Actions**:

| Secret        | Used by          | Value                                                    |
|---------------|------------------|----------------------------------------------------------|
| `PROD_HOST`   | deploy-prod      | prod host IP / DNS                                       |
| `PROD_USER`   | deploy-prod      | ssh user on prod host                                    |
| `PROD_SSH_KEY`| deploy-prod      | private key whose pubkey is in prod's `~/.ssh/authorized_keys` |
| `PROD_DOMAIN` | (optional)       | public hostname for the admin / client UI                |
| `BETA_HOST`   | deploy-beta      | beta host                                                |
| `BETA_USER`   | deploy-beta      | ssh user on beta host                                    |
| `BETA_SSH_KEY`| deploy-beta      | private key for beta authorized_keys                     |
| `BETA_DOMAIN` | (optional)       | beta hostname                                            |

Two GitHub **environments** (`production`, `beta`) with required reviewers
let you gate prod deployments.

## Deploy flow

1. Push (or merge a PR) to `main`.
2. `build.yml` runs: quality gates + matrix build of four images, all pushed
   with tags `latest`, `prod`, `beta`, and `sha-<sha>`.
3. `deploy-prod.yml` SSHes into the prod host and runs
   `scripts/deploy-remote.sh prod <tag>`. Same for beta (manual dispatch
   only — beta is opt-in).

### Push triggers

Only `deploy-prod.yml` runs on push-to-main. `deploy-beta.yml` requires a
manual **Run workflow** dispatch. To enable beta-on-push, add a `push`
block in `deploy-beta.yml` matching the same paths filter as prod.

## Migrations

**Migrations are never auto-run by containers.** Apply them by hand:

```bash
# Recommended: via the admin container (uses container's MUD_DB_PATH).
docker compose --profile prod run --rm mud-admin \
  node scripts/migrate.mjs --list

docker compose --profile prod run --rm mud-admin \
  node scripts/migrate.mjs --no-backup

# On bare host (only if DB is at $MUD_DB_PATH):
MUD_DB_PATH=$PWD/data/prod/mud.world.db \
MUD_PLAYERS_DB=$PWD/data/prod/mud.players.db \
  node scripts/migrate.mjs --list
```

`migrate.mjs` defaults `MUD_DB_PATH` to `ModularMudServer/mud.world.db`
when run on the host. **Do not** run migrations against
`ModularMudServer/mud.world.db` on a deploy host — that file is the
source artifact checked into the repo and is **not** the live DB. Always
target `data/prod/...` or `data/beta/...`.

## Backups

| What                       | Frequency | Where                                    |
|----------------------------|-----------|------------------------------------------|
| world DB snapshots         | each migration (`--backup` default) | `data/{prod,beta}/_snapshots/` |
| players DB                 | nightly (cron on each host)          | `~/mud/backups/mud.players.db.YYYY-MM-DD` |

Prod-host crontab:

```cron
0 3 * * *  cp $HOME/mud/data/prod/mud.players.db $HOME/mud/backups/mud.players.db.$(date +\%F)
0 3 * * *  find $HOME/mud/backups -type f -mtime +30 -delete
```

Beta-host crontab:

```cron
0 3 * * *  cp $HOME/mud/data/beta/mud.players.db $HOME/mud/backups/mud.players.db.$(date +\%F)
0 3 * * *  find $HOME/mud/backups -type f -mtime +30 -delete
```

`scripts/safe-db-swap.sh` snapshots the world DB at the start of every
swap. `scripts/prune-snapshots.sh <N> data/prod` keeps the N most recent
snapshots.

## Rollback

Two flavors:

1. **App rollback (no DB change).** Re-deploy a previous image tag:
   `Actions → deploy-prod → Run workflow → tag: sha-<previous-sha>`.
   Player + world DBs are untouched.
2. **World DB rollback.** Stop the relevant profile, restore the latest
   `data/{prod,beta}/_snapshots/mud.world.db.<ISO>.bak`:
   ```bash
   cd ~/mud
   docker compose --profile prod stop mud-server mud-admin
   cp data/prod/_snapshots/mud.world.db.<ISO>.bak data/prod/mud.world.db
   docker compose --profile prod start mud-server mud-admin
   ```
   Players DB is **not** touched — safe.

If prod was rolled back, re-sync beta:

```bash
bash scripts/sync-prod-to-beta.sh
```

## Local development vs production

`docker-compose.yml` is the same file used on both hosts. Local
development uses `npm run dev:*` as before; the Docker setup is the
deployment surface.

To iterate on a container locally:

```bash
TAG=dev REGISTRY= docker compose --profile prod build
TAG=dev REGISTRY= docker compose --profile prod up mud-server
```

The empty `REGISTRY` makes docker-compose treat the images as locally
built without a registry prefix.

## Adding a third environment later

1. Add a profile block (`gamma`) to `docker-compose.yml` mirroring beta.
2. Add `data/gamma/` to your deploy host (or a new gamma host).
3. Bootstrap `data/gamma/` via a `scripts/reseed-gamma.sh` derived from
   `scripts/reseed-beta.sh` — **or** mirror from prod with
   `scripts/sync-prod-to-gamma.sh` derived from `sync-prod-to-beta.sh`.
4. Add `deploy-gamma.yml` workflow + secrets.

Workflows build images already; the deploy can pin any tag.

## Production checks before going live

- [ ] host has Docker Engine 24+ and Compose v2 (`docker compose version`)
- [ ] user is in the `docker` group (no sudo in scripts)
- [ ] SSH keys for `github-actions` deploy key installed on the host
- [ ] repo cloned at `~/mud` (or `REPO_DIR` adjusted in `deploy-remote.sh`)
- [ ] `.env` present on the host with real domain names + ports
- [ ] `data/prod/mud.world.db` and `data/prod/mud.players.db` exist on prod host
- [ ] `data/beta/mud.world.db` and `data/beta/mud.players.db` exist on beta host (bootstrap or first sync)
- [ ] Caddy has HTTPS certs (auto-issued on first request via ACME)
- [ ] GitHub environments configured with required reviewers for prod
