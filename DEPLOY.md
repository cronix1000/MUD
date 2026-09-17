# Deploy runbook

Two production-grade Linux hosts. Each runs the **same** `docker-compose.yml`
under a different profile (`prod` or `beta`). GitHub Actions builds the
images, then deploys them via SSH.

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
        │  Linux          │             │  Linux          │
        │  docker compose │             │  docker compose │
        │  --profile prod │             │  --profile beta │
        │  ports: 80/443  │             │  ports: 8080/8443│
        │  data/mud-*     │             │  data/mud-*     │
        └─────────────────┘             └─────────────────┘
                 │                                │
        players stay here               players stay here
        world rebuilt on push           world rebuilt on push
```

## One-time host setup (do on each Linux host)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exec sudo -u $USER -- bash -l    # re-login so docker group takes effect

# Clone the repo
mkdir -p ~/mud && cd ~/mud
git clone git@github.com:cronix1000/MUD.git .

# Drop a populated .env (per-host values, see docker/.env.example)
cp docker/.env.example .env
$EDITOR .env

# Seed the data volume (first time only — see first-deploy.md below)
node scripts/split-existing-db.mjs \
     --src  ModularMudServer/mud.db \
     --world ModularMudServer/mud.world.db \
     --players ModularMudServer/mud.players.db

# Verify the stack is happy before any deploys
docker compose --profile prod pull || true   # ok if no images yet
docker compose --profile prod up -d
```

## GitHub repo secrets (per environment)

Set under **Settings → Secrets and variables → Actions**:

| Secret        | Used by          | Value                                                    |
|---------------|------------------|----------------------------------------------------------|
| `PROD_HOST`   | deploy-prod      | prod host IP / DNS (e.g. `mud.example.com` or `1.2.3.4`) |
| `PROD_USER`   | deploy-prod      | ssh user on prod host (e.g. `mud` or `ubuntu`)           |
| `PROD_SSH_KEY`| deploy-prod      | private key whose pubkey is in prod's `~/.ssh/authorized_keys` |
| `PROD_DOMAIN` | (optional)       | public hostname for the admin / client UI                |
| `BETA_HOST`   | deploy-beta      | beta host                                                |
| `BETA_USER`   | deploy-beta      | ssh user on beta host                                    |
| `BETA_SSH_KEY`| deploy-beta      | private key matching beta's authorized_keys              |
| `BETA_DOMAIN` | (optional)       | beta hostname                                            |

Two GitHub **environments** (`production`, `beta`) with required reviewers
let you gate prod deployments.

## Deploy flow

1. Push (or merge a PR) to `main`.
2. `build.yml` runs: quality gates + matrix build of four images, all pushed
   with tags `latest`, `prod`, `beta`, and `sha-<sha>`.
3. `deploy-prod.yml` SSHes into the prod host as `$PROD_USER` and runs
   `scripts/deploy-remote.sh prod <tag>`. Same for beta (manual dispatch only
   by default — see note below).

### Push triggers

Only `deploy-prod.yml` runs on push-to-main. `deploy-beta.yml` requires a
manual **Run workflow** dispatch — beta is opt-in. That keeps QA in control:
a `git push` does **not** light up the beta server automatically.

If you want beta-on-push, remove the `workflow_dispatch` line and add a
`push` block matching the same paths filter used for prod.

## Migrations

Migrations are **never** auto-run by the server or the admin container.
Apply them by hand after each deploy:

```bash
# on the host
cd ~/mud
docker compose --profile prod run --rm mud-admin \
  node scripts/migrate.mjs --list       # review pending

docker compose --profile prod run --rm mud-admin \
  node scripts/migrate.mjs --no-backup # actually apply
```

(The admin service in compose has the world DB bind-mounted read-only;
running the migrate script in the same container sees both DBs.)

## Backups

| What                       | Frequency | Where                                    |
|----------------------------|-----------|------------------------------------------|
| world DB snapshots         | each deploy | volume `mud-data/_snapshots` (planned)   |
| players DB                 | nightly   | `$HOME/mud/backups/mud.players.db.YYYY-MM-DD` |

`scripts/safe-db-swap.sh` snapshots the world DB at the start of every
swap. Schedule a nightly cron on each host:

```cron
0 3 * * *  cp $HOME/mud/data/mud.players.db $HOME/mud/backups/mud.players.db.$(date +\%F) ; find $HOME/mud/backups -type f -mtime +30 -delete
```

## Rollback

Two flavors:

1. **App rollback (no DB change).** Re-deploy a previous image tag:
   `Actions → deploy-prod → Run workflow → tag: sha-<previous-sha>`.
   Player + world DBs are untouched.
2. **World DB rollback.** Stop prod, restore the latest
   `data/_snapshots/mud.world.db.<ISO>.bak`:
   ```bash
   cd ~/mud
   docker compose --profile prod stop mud-server mud-admin
   cp data/_snapshots/mud.world.db.<ISO>.bak data/mud.world.db
   docker compose --profile prod start mud-server mud-admin
   ```
   Player DB is **not** touched — safe.

## Local development vs production

`docker-compose.yml` is designed for the two prod/beta hosts. Local
development uses `npm run dev:*` as before; the only thing the Docker setup
overrides is the deployment surface.

To iterate on a container locally:

```bash
TAG=dev REGISTRY= docker compose --profile prod build
TAG=dev REGISTRY= docker compose --profile prod up mud-server
```

The empty `REGISTRY` makes docker-compose treat the images as locally built
without a registry prefix.

## Adding a third environment later

1. Add a profile block (`gamma`) to `docker-compose.yml` mirroring beta.
2. Copy `scripts/deploy-remote.sh` as `scripts/deploy-remote-gamma.sh`
   if it needs extra logic (e.g. blue/green).
3. Add `deploy-gamma.yml` workflow + secrets.
4. Done — workflows build images already, so the deploy can pin any tag.

## Production checks before going live

- [ ] host has Docker Engine 24+ and Compose v2 (`docker compose version`)
- [ ] user is in the `docker` group (no sudo in scripts)
- [ ] SSH keys for `github-actions` deploy key installed on the host
- [ ] repo cloned at `~/mud` (or `REPO_DIR` adjusted in `deploy-remote.sh`)
- [ ] `.env` present on the host with real domain names + ports
- [ ] `data/mud.world.db` and `data/mud.players.db` exist (run the split
      script if you have an existing single `mud.db`)
- [ ] Caddy has HTTPS certs (auto-issued on first request via ACME)
- [ ] GitHub environments configured with required reviewers for prod
