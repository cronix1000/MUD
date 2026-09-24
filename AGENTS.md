# AGENTS.md - Root Project Rules

This file is the single source of truth for AI coding agents working in this monorepo. **Read the per-package `AGENTS.md` before editing a specific server.**

## Repository Layout

```
/
├── package.json              # npm workspaces root (this file's parent)
├── ModularMudServer/         # C++17 ECS server — CMake/MSBuild, NOT an npm workspace
├── mud-ws-gateway/           # Python WebSocket gateway — uv/pyproject
├── MudClient/                # Nuxt 3 player client (xterm.js UI)
└── MudAdmin/                 # Nuxt 4 admin UI (world-building + management)
```

The C++ server (`ModularMudServer`) is intentionally **excluded from npm workspaces**. Build it with Visual Studio, `cmake`, or `vcpkg` — see `ModularMudServer/AGENTS.md` for details.

## Build & Run Commands

| Task              | Command                          |
|-------------------|----------------------------------|
| Install all JS    | `npm install` (from repo root)   |
| Run client dev    | `npm run dev:client`             |
| Run admin dev     | `npm run dev:admin`              |
| Run gateway dev   | `npm run dev:gateway`            |
| Build all JS      | `npm run build:all`              |
| Typecheck client  | `npm run typecheck:client`       |
| Build C++ server  | see `ModularMudServer/AGENTS.md` |
| Bring up Postgres | `docker compose -f docker/postgresql/docker-compose.yml up -d postgres` |

`MudAdmin` has no `typecheck` script — its `npm run build` is the canonical compile + typecheck gate. Run `npm run build:admin` from the repo root.

## Workspace Naming

`MudClient` declares `name: "mudclient"` (lowercase) and `MudAdmin` declares `name: "MudAdmin"` (PascalCase). The root scripts target these names — **don't rename packages without updating `package.json` scripts at the root**.

## Database — Postgres everywhere

World content (regions, rooms, items, mobs, …) and player accounts live in a single Postgres 16 instance configured by `MUD_DATABASE_URL` (libpq-style URL; the role-level `search_path = world, players, _meta, public` is set by `docker/postgresql/init/00-bootstrap.sh` so unqualified table names resolve into the right schema without needing URL options).

The C++ server (`ModularMudServer/PostgresDatabase.cpp`) and the admin UI (`MudAdmin/server/utils/db.ts`) both connect through this URL. `mud-server`, `mud-admin`, and any future migration tool read **only** from Postgres at runtime. There is no SQLite fallback at runtime; if `MUD_DATABASE_URL` is unset, both services refuse to start.

The legacy SQLite files (`mud.world.db`, `mud.players.db`) exist only as a transition aid:

- During the cutover, `scripts/sqlite-to-pg.mjs` reads them once and bulk-loads the rows into the `world.*` / `players.player_*` tables.
- After 30 days of clean operation, delete them.

The Postgres service lives in `docker/postgresql/docker-compose.yml` (included from the root compose). It bootstraps two roles (`mud_prod`, `mud_beta`) and two databases on first boot, with passwords read from `docker/postgresql/pg.env`.

### Production conn strings — Pattern 1 (env file on disk)

This repo uses **Pattern 1**: secrets live in env files on the host (`docker/.env`, `docker/postgresql/pg.env`, `ModularMudServer.vcxproj.user`), never committed. Each consumer reads one `MUD_DATABASE_URL` env var at process start:

| Consumer | URL source |
|---|---|
| `mud-server.exe` (local dev, F5) | `ModularMudServer.vcxproj.user` → `<LocalDebuggerEnvironment>` |
| `mud-server.exe` (deployed prod) | `docker-compose.yml:84` reads `MUD_DATABASE_URL_PROD` from `docker/.env` |
| `mud-server-beta` (deployed beta) | `docker-compose.yml:172` reads `MUD_DATABASE_URL_BETA` from `docker/.env` |
| `MudAdmin` (local dev) | `MudAdmin/.env` → `MUD_DATABASE_URL` |
| `mud-admin` (deployed prod) | `docker-compose.yml:120` reads `MUD_DATABASE_URL_PROD` |
| `mud-admin-beta` (deployed beta) | `docker-compose.yml:213` reads `MUD_DATABASE_URL_BETA` |

Canonical URL shapes (no `?options=...` segment — `ModularMudServer/PostgresDatabase.cpp:51-66` and `MudAdmin/server/utils/db.ts:43-52` set `search_path` per-connect, and the role default is set by `docker/postgresql/init/00-bootstrap.sh:60-61`):

```
# Local dev (Windows + SSH tunnel)
postgresql://mud_beta:<pw>@127.0.0.1:5432/mud_beta

# Beta on the VPS (inside docker-compose; `postgres` is the docker network alias)
postgresql://mud_beta:<pw>@postgres:5432/mud_beta

# Prod on the VPS
postgresql://mud_prod:<pw>@postgres:5432/mud_prod
```

If you ever need options in a URL for a non-app consumer (psql, ETL), use `+` instead of `%20` for spaces — libpq doesn't decode `%20` inside `?options=...`:

```
postgresql://mud_beta:<pw>@127.0.0.1:5432/mud_beta?options=-c+search_path=world,players,_meta,public
```

**Rotation procedure:**
1. Edit `docker/postgresql/pg.env` on the VPS, set new `MUD_PROD_PASSWORD` (or `MUD_BETA_PASSWORD`).
2. `cd ~/postgre && docker compose restart postgres` to load the new password.
3. `cd ~/mud && TAG=prod REGISTRY=ghcr.io/cronix1000 docker compose --profile prod up -d --force-recreate mud-server mud-admin` (or `--profile beta` for beta) to pick up the new `docker/.env` value.
4. Smoke: `docker logs --tail=20 mud-server | grep "Connected (search_path="`.

**Out of scope for now (deliberate tech debt):**
- Per-role unique passwords (currently `super_mud_pass_1` is reused across `mud_prod`, `mud_beta`, and `POSTGRES_PASSWORD`). When Pattern 1 starts feeling cramped (3+ environments, ops team, compliance ask), promote to Pattern 2 (distinct passwords per role), then Pattern 3 (docker secrets / Vault).
- Auto-rotation. Manual for now.

### Local development DB access

`mud-server.exe` runs on a Windows host and reaches the VPS Postgres through an SSH tunnel (host loopback `127.0.0.1:5432`). Full procedure, including the firewall/rationale, is in `scripts/postgres-connection.md`. The two things that bite newcomers most:

1. `mud-server.exe` issues `SET search_path TO world, players, _meta, public` itself on every connect (`ModularMudServer/PostgresDatabase.cpp:54-58`). MudAdmin's pool does the same on each new client (`MudAdmin/server/utils/db.ts:47-50`). The role default is set by `docker/postgresql/init/00-bootstrap.sh` for fresh volumes and `01-search-path.sh` for existing ones. **None of the three need URL `?options=...`**. Note: when both URL options and the C++/admin `SET` are present, the per-session URL option wins — so URLs should NOT include `?options=-c%20search_path=...`.
2. Point the dev tunnel at `mud_beta`, not `mud_prod`. Beta is a QA mirror; admin edits against prod hit live player data. `scripts/pg-sync-prod-to-beta.sh` mirrors prod world content into beta.

A template URL lives in `ModularMudServer/.env.example`.

## Worldbuilding & admin responsibilities

The admin (`MudAdmin/`) is the source of truth for game-world content. It owns:

- Migrations (`MudAdmin/server/utils/migrate.ts`) — versioned DDL applied manually via `/admin/_migrate`. Always backs up the live database to `mud.db.snapshots/mud.snap.<ISO>.sql` via `pg_dump` before any change.
- Composite-key schemas (regions, rooms, mobs, items, recipes, etc.) — `MudAdmin/app/utils/composite-key.ts` and the server-side mirror must stay in lockstep.
- Wiki links (`[[type:id]]`) — `MudAdmin/app/utils/wikiParser.ts`, `WikiIdInput.vue`, `WikiText.vue`, plus the `GET /api/search/entities` endpoint.
- Snapshots (`/admin/snapshots`) — manual `pg_dump` files for human-driven rollback.
- Generator scripts for `instanced` regions — Lua files under `ModularMudServer/scripts/regions/generators/` edited in VSCode.

The C++ server reads Postgres at boot (`ModularMudServer/PostgresDatabase.cpp`) and picks up Lua scripts on `ScriptManager::load_all_scripts`. Any new column, table, or script convention must match across all three (admin ↔ DB ↔ C++).

## General Rules for Agents

1. **Don't run destructive commands** (`rm -rf`, force pushes, hard resets) without explicit user confirmation.
2. **Don't commit** unless the user explicitly asks. The repo isn't a git repo right now anyway.
3. **Read before editing.** Always `Read` a file before `Edit`ing it.
4. **Match existing conventions.** Each subproject has its own `AGENTS.md` — follow it.
5. **Cross-server changes require care.** A change to the WebSocket protocol in `mud-ws-gateway/src/` must match the client in `MudClient/composables/` and the server in `ModularMudServer/NetworkSystem.*`. A change to a wiki entity type must update `EntityType` + `ENTITY_COLORS` + `ENTITY_ICONS` + `knownTypes` in `MudAdmin/app/utils/wikiParser.ts`, plus the matching case in `buildHref()` (server) and `entityHref()` (client).
6. **No emojis in code or commits** unless the user requests them.
7. **No comments added to code** unless the user requests them — code should be self-documenting.

## Adding a New Workspace

1. Create the package directory with its own `package.json`.
2. Add the directory name to the `workspaces` array in root `package.json`.
3. Add a `dev:<name>` / `build:<name>` script at root.
4. Create an `AGENTS.md` inside the new package mirroring the pattern used by `MudClient` or `MudAdmin`.

## Per-Package AGENTS.md

- `ModularMudServer/AGENTS.md` — C++ build, ECS conventions, vcpkg deps, Lua script reload semantics.
- `MudClient/AGENTS.md` — Vue/Nuxt client conventions (create or update as needed).
- `MudAdmin/AGENTS.md` — Nuxt 4 admin conventions, world-building pages, wiki links, composite keys, migrations, palette/symbol model.
- `mud-ws-gateway/AGENTS.md` — Python/FastAPI/uv conventions (create or update as needed).
