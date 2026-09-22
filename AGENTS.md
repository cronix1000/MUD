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

World content (regions, rooms, items, mobs, …) and player accounts live in a single Postgres 16 instance configured by `MUD_DATABASE_URL` (libpq-style URL, with `options=-c search_path=world,players,_meta,public` set so unqualified table names resolve into the right schema).

The C++ server (`ModularMudServer/PostgresDatabase.cpp`) and the admin UI (`MudAdmin/server/utils/db.ts`) both connect through this URL. `mud-server`, `mud-admin`, and any future migration tool read **only** from Postgres at runtime. There is no SQLite fallback at runtime; if `MUD_DATABASE_URL` is unset, both services refuse to start.

The legacy SQLite files (`mud.world.db`, `mud.players.db`) exist only as a transition aid:

- During the cutover, `scripts/sqlite-to-pg.mjs` reads them once and bulk-loads the rows into the `world.*` / `players.player_*` tables.
- After 30 days of clean operation, delete them.

The Postgres service lives in `docker/postgresql/docker-compose.yml` (included from the root compose). It bootstraps two roles (`mud_prod`, `mud_beta`) and two databases on first boot, with passwords read from `docker/postgresql/pg.env`.

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
