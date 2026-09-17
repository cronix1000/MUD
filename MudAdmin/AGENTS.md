# AGENTS.md - MudAdmin (Nuxt 4 Admin UI)

Admin / management UI for the MUD. Nuxt 4. Single-user local tool — no auth.

## Workspace Identity

- Package name: `MudAdmin` (PascalCase — referenced as such in root scripts).
- Workspace root: `MudAdmin/`.

## Common Commands

| Task | Command |
|------|---------|
| Dev server | `npm --workspace MudAdmin run dev` |
| Build | `npm --workspace MudAdmin run build` |
| Generate static | `npm --workspace MudAdmin run generate` |

(From repo root, the shortcut is `npm run dev:admin` / `npm run build:admin`.)

No typecheck script — `npm run build:admin` is the canonical compile + typecheck gate.

## Conventions

- Nuxt 4 conventions (file-based routing in `app/pages/`).
- Server-side endpoints and DB utils live under `server/`.
- Reuse components and composables from `MudClient/` where possible — keep the two UIs visually consistent.
- **No comments added to code** unless the user requests them.

## Pages Overview

After running migrations at `/admin/_migrate`, the following world-building pages are available:

- **Overview** (`/admin/overview`) — stat cards, regions-by-kind, region grid, quick links.
- **Sidebar tree** — `app/components/admin/WorldTree.vue` + `server/api/nav/tree.get.ts` returns nested `Worlds > Regions > Rooms`, grouped as Dashboard / World Building / World Tree / Player / World raw tables.
- **Snapshots** (`/admin/snapshots`) — create/restore/delete DB backups in `ModularMudServer/mud.db.snapshots/` (restore makes a safety backup first).
- **Regions** (`/admin/world/regions`) — list of regions. Click into one for a per-region room graph view, or a per-region editor for `region_kind` (`static | tutorial | instanced`), generator script, template config, and tutorial steps JSON.
- **Region map** (`/admin/world/regions/{world}::{region}/map`) — auto-laid-out SVG of all rooms + exits, with a Download SVG button.
- **Procedural preview** (`/admin/world/regions/{world}::{region}/preview-instance`) — server loads generator script via `server/api/regions/[composite]/preview-instance.get.ts` and applies it client-side to the region's `template_config_json`.
- **Palette** (`/admin/world/terrains`) — edit `world_terrains` tiles (symbol, color, move cost, blocks). Single-char symbols; patterns removed in migration 010.
- **Rooms** — open via the room map; 7-tab editor (`identity | layout | map | exits | spawns | scripts | raw`). Save writes `world_rooms` + diffs `world_room_exits` + `world_room_spawns` in one batch.
- **Mobs** (`/admin/world_mobs/{world}::{template_id}`) — tabbed editor with identity/stats/AI-loot-dialogue/script/advanced tabs. Uses `WikiIdInput` for `loot_drop`.
- **Items, NPCs, Quest objectives/rewards** — managed via the generic table page.
- **Quests** (`/admin/world/quests`) — list + per-quest editor with objectives and rewards.
- **Recipes** (`/admin/recipes`) — list + per-recipe editor with explicit inputs/outputs/skill/station. Schema in `world_recipes` (composite PK `world_id + recipe_id`).
- **Loot** (`/admin/loot`) — list + weighted-entry editor; shows reverse-linked mobs.
- **Skills** — `world_skills` with per-skill `xp_curve` + `xp_curve_params`; curve is read at runtime by the C++ server.
- **Interactables** — `world_interactables` with optional `station_type` (used to mark alchemical circles, forges, anvil, etc.).
- **Scripts** (`/admin/scripts`) — browse Lua files in `ModularMudServer/scripts/`, preview contents, and deep-link to VSCode via `vscode://file/...`. Validate syntax with `luac -p` if available.
- **Generic table** (`/admin/[table]`) — card view with `InspectDrawer`, filters, search. Backed by `server/api/tables/[table]/...`.

## Wiki links (`[[type:id]]`)

Symbolic cross-entity references in `description`, `loot_drop`, `template_id`, `target_room`, etc. Implementation in `app/utils/wikiParser.ts` + `app/utils/wikiId.ts` + `app/components/admin/{WikiIdInput,WikiText}.vue`.

- Syntax is decoration only — on save, `resolveWikiId(value, worldId)` strips the `worldId::` prefix where applicable, so DB columns always store the bare local id (`goblin`, `floor1::3`, etc.).
- `WikiIdInput` is a single-line input with `[[` autocomplete. `WikiText` is a textarea with the same picker plus a clickable badge preview.
- Picker trigger regex: `/\[\[([a-z]+)?(:([^\]\n]*))?$/`. On `[[mob` it shows all mobs; `[[mob:g` filters to goblin; bare `[[` shows type chip-strip buttons.
- Type-aware search endpoint: `GET /api/search/entities?type=<mob|npc|item|quest|region|skill|recipe|room|interactable>&world_id=<worldId>&q=<query>`. Wildcard path (`no type`) still works. Hrefs encode the full composite key (e.g. `default::floor1::1`).
- Adding a new entity type: add to `EntityType` + `ENTITY_COLORS` + `ENTITY_ICONS` + `knownTypes` in `app/utils/wikiParser.ts`, plus the matching case in `buildHref()` in `server/api/search/entities.get.ts` and `entityHref()` in `app/utils/wikiParser.ts`.

## Migrations

Database schema changes are versioned in `server/utils/migrate.ts`. Visit `/admin/_migrate` and click **Run pending** to apply. Each run:

1. Copies `mud.db` to `mud.db.bak.{ISO timestamp}` before any DDL.
2. Runs pending migrations inside a transaction; aborts on first failure (rolled back automatically).
3. Records applied versions in the `_migrations` table.

Migrations are **never** auto-run on admin startup — you control when they execute.

Snapshot-style backups live separately in `ModularMudServer/mud.db.snapshots/` and are managed via `/admin/snapshots`. They survive migration runs and exist purely for human-driven rollback. Restore always makes a `mud.db.snap.<ISO timestamp>` first.

## Script editing workflow

Editing is **always in VSCode** — the admin never writes Lua files.

1. In admin, find a script path (e.g. `room/room_one.lua`) in any Script tab.
2. Click **Open in VSCode** — fires a `vscode://file/...` deep link.
3. Edit, save. The C++ server picks it up on next load (`ScriptManager::load_all_scripts`).
4. Click **Validate** in admin to confirm syntax via `luac -p`.

`MUD_SCRIPTS_PATH` env var overrides the default `../ModularMudServer/scripts`.

## Composite primary keys

Many `world_*` tables have composite primary keys (e.g. `world_rooms = (world_id, region_id, room_id)`). The admin encodes them as `world::region::room` in URLs and decodes them in `app/utils/composite-key.ts` and `server/utils/composite-key.ts`. `encodeCompositeKey()` returns the plain `world::region::room` form (no URL encoding); callers wrap with `encodeURIComponent` for URLs.

Adding a new composite-key table:
1. Add it to `COMPOSITE_KEYS` in **both** copies of `composite-key.ts`.
2. Add it to `ALLOWED_TABLES` in `server/utils/db.ts`.
3. If it has a specialized editor, branch on `table === '...'` in `app/pages/admin/[table]/[id].vue`. Otherwise the generic JSON-textarea form is used automatically.

Auto-increment PKs: `world_room_exits` and `world_room_spawns` have single `id INTEGER PRIMARY KEY AUTOINCREMENT`. They are NOT in `COMPOSITE_KEYS`; the insert path in `server/utils/db.ts` skips the PK requirement when the column is `INTEGER` + `pk=1`.

## Region kinds

`world_regions.region_kind` is one of:
- `static` — designer-authored, persistent, no cap.
- `tutorial` — like static but with `tutorial_steps_json` (no persisted player state; restart on login).
- `instanced` — procedurally generated per-visit with a random seed, in-memory only, destroyed on player exit, hard cap at 50 concurrent instances. Uses `generator_script` (Lua in `scripts/regions/generators/`) + `template_config_json`.

Generator scripts return a JSON room layout; client-side preview applies it to a static region temporarily before deploying.

## Stations and recipes

`world_interactables.station_type` tags an interactable as a crafting station (`alchemy_circle`, `forge`, `anvil`, `enchanting_altar`, etc.). Recipes in `world_recipes` declare a station type they require; portable stations (`alchemy_circle`) can be carried by mobs/players.

Skill XP curves are per-skill in `world_skills.xp_curve` + `xp_curve_params` (parameters like base, multiplier, asymptote).

## Palette: single-char symbols (Option A)

Tiles in `world_terrains` are keyed by a **single char** `symbol`. The C++ server stores terrain as a `char` in `globalTerrain` (`ModularMudServer/SQLiteDatabase.cpp:424`) and the renderer treats the symbol as a single character (`ModularMudServer/NetworkSyncSystem.cpp:132`).

This gives ~90 usable symbols per world. Reuse the same letter with different colors per world if you need more visual variety.

Migration 010 dropped the `pattern` column entirely — palette tiles are color only, no per-tile patterns. The Layout tab uses `LayoutPainter.vue` (chip-strip + grid + column header row, 28×28 cells, 6 px spawn dots) with a width-mismatch banner that one-click resizes width or height.

### Future: multi-char symbols (Option B)

If you exhaust ~90 distinct symbols per world, the upgrade path is:

1. Add `symbol_width INTEGER DEFAULT 1` to `world_worlds` (already done in migration 005).
2. Server-side changes (`ModularMudServer/`):
   - `TerrainDef::symbol` -> `std::string`.
   - `globalTerrain` -> `std::unordered_map<std::string, TerrainDef>`.
   - `RoomFactory::ParseLayout` -> slice each row string by `symbol_width` instead of char-by-char.
   - `NetworkSyncSystem.cpp:132` -> `std::string terrainKey` instead of `char`.
   - Remove `localTerrain` from `RoomLayoutComponent` (no longer needed).
3. Admin: palette editor already accepts a 1-char input field; widen to `maxlength` based on `symbol_width`.
4. Existing rooms keep `symbol_width=1` and work unchanged.

This is intentionally deferred — it's an opt-in per-world setting.

## Row width fix (C++ side)

`RoomFactory::ParseLayout` historically skipped spaces without advancing `x`, causing rows to be smushed. Fixed at `ModularMudServer/RoomFactory.cpp:215` to advance `x` on space and write `-1` (void). This fixed the row width mismatch with `width` column.

## Adding new world tables to the admin

1. Add the table to `ALLOWED_TABLES` in `server/utils/db.ts`.
2. If it has a composite PK, add it to `COMPOSITE_KEYS` in both copies of `composite-key.ts`.
3. If you need a specialized editor (tabbed/form), create `app/components/admin/XEditor.vue` and branch on `table === '...'` in `app/pages/admin/[table]/[id].vue`.
4. Otherwise the generic JSON-textarea form (card view + `InspectDrawer` + filters + search) is used automatically.
5. If it has a wiki-link text field, wire it through `WikiIdInput` (single-line) or `WikiText` (textarea + preview); call `resolveWikiId(value, worldId)` before save.

## Known conventions

- Components prefixed `Admin*` are auto-imported — use `AdminWikiIdInput`, `AdminWikiText`, `AdminLayoutPainter`, etc.
- Server DB writes always go through `server/utils/db.ts` (`insertRow`, `updateRow`, `deleteRow`) — do not write SQL directly from a page handler.
- Composite-key IDs are URL-encoded as `encodeURIComponent(encodeCompositeKey(table, row))`.
- New admin pages should add themselves to the sidebar (`app/layouts/admin.vue`) and `server/api/nav/tree.get.ts` if they belong in World Building / World Tree / Player / World raw tables.
