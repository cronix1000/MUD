# MudAdmin Editor Revamp — Schema-Driven Editor Framework + Terrain Runtime

Revamp all entity editors around a rich schema registry so all 18 types get real widgets, sections, validation and a consistent experience; fold terrain + region special pages into the framework; extend terrain with foreground/background colors and make its flags actually enforced by the server; fix the schema/server drift and cross-cutting bugs found in the audit. Builds on `MudAdmin/UI_REMAKE_PLAN.md` (Ui* layer, Phases 2-3). Per-phase gate: `npm run build:admin`. No new runtime dependencies. **No seeding features anywhere** — existing `/api/terrains/seed*` endpoints stay untouched but are not surfaced in new UI.

## Phase 0 — UI primitives (editor subset of UI_REMAKE_PLAN §4)

Create `MudAdmin/app/components/ui/`: `UiButton` (primary/ghost/danger, loading), `UiPanel` (titled card), `UiTabs`, `UiToast` + `useToast()`, `UiConfirmDialog` (replaces native `confirm()` in touched pages). Dark terminal styling, zero page moves.

## Phase 1 — Schema registry v2 (`MudAdmin/app/utils/entitySchemas.ts`)

Extend `EntityFieldSpec`: `label`, `help`, `required`, `min`/`max`, `placeholder`, `span`, and widget set `text | textarea | number | bool | select(options) | color | bgcolor | script | ref | wikitext | array(columns) | map(valueSpec) | json`. `EntitySchema` gains `sections: {title, fields[]}[]` and `listConfig`.

Re-register all 18 types to match what the C++ loaders actually read:
- Arrays → `EntityArrayField`: quest `objectives`/`rewards`, recipe `inputs`/`outputs` (item-ref column), mob `attack_patterns`, loot-shaped lists
- Maps → new `EntityMapField`: shop `inventory` (item-ref → stock spec), faction `relations` (faction-ref → number), room `floor_legend` (char → terrain-ref; not editable today)
- Groups: skill `costs` ({stamina, mana, health}), skill_category `stats`, region `floor_palette` (tile array with color selects + chip preview, blocks-flag normalization on save)
- `script` → ScriptPicker (currently declared but rendered as plain text — dead); refs → `WikiIdInput` with `refType` (mob.loot_drop, recipe.skill_id, shop.mob_id, room.region_id, …); colors → new `AnsiColorSelect`
- Server-ignored fields (mob `dialogue_root`, interactable `station_type`, skill `xp_curve*`, item `script`, loot_table `name`, zone `is_active`) stay with help text "(not yet read by the server)"
- Region schema aligned to the real editor: `floor_tribe`, `biome_theme`, `floor_index`, `floor_meta`, `floor_settings`, `floor_palette`

## Phase 2 — Generic editor engine v2

New `MudAdmin/app/components/EntityDocEditor.vue`; `entities/[type]/[id].vue` becomes a thin shell dispatching to it (the 7 custom editors keep their branch chain this phase).
- Sectioned cards; widget dispatch to ScriptPicker / WikiIdInput / EntityArrayField / EntityMapField / AnsiColorSelect
- Dirty guard on route leave, Revert, sticky save bar with saved/dirty state, toasts, confirm dialog for delete
- Duplicate button (GET + POST with suffixed id)
- Raw JSON as a tab with inline parse errors (currently uncaught on blur); unregistered keys visible via raw tab
- `parent_id` becomes a same-type picker plus a resolved-merge preview implementing `PostgresDatabase::MergeDocs` semantics (objects deep-merge, arrays/scalars replace)

## Phase 3 — Lists + create panels + API

- `entities/[type]/index.vue`: pagination with total count, sorting (id/name/updated), row count, per-row duplicate and delete (confirm + toast), bulk select+delete
- API: list returns `total`; new `server/api/entities/[type]/[id]/duplicate.post.ts`; bulk delete; `upsertEntity` validates parent exists + no cycles, sets `mod_origin: 'admin'`
- Config-driven `EntityCreatePanel` replaces the seven `Admin*Create.vue` forms; room next-free-id and zone `region::zone` key remain as per-type plugins

## Phase 4 — Fold terrain + region into the framework (admin parity)

- **Terrain**: `/entities/terrain` becomes the palette experience — spreadsheet rows, **foreground + background color selects with live tile swatch (symbol rendered in fg color on bg color)**, conflict highlight, and "Validate all layouts" moved here with links pointing at `/entities/room/{id}` (currently detour through `/world_rooms/...` stubs). No seed buttons. `/entities/terrain/{id}` uses the engine with both color widgets + swatch. `/world/terrains` becomes a redirect stub.
- **Background color vocabulary**: extend `app/utils/ansi.ts` with `{x`-style background codes (matching Phase 5's Colorize syntax) + combined fg-on-bg preview helper; align labels with actual server semantics (note `&w` maps to ANSI reset, not white; `&n`/`&o`/`&p` fold to nearest basic colors). Terrain schema gains optional `bg_color`.
- **Region**: region editor content (Identity / Floors / Palette tile editor / Zones / Raw) moves under `/entities/region/[id]`; map page stays; `/world/regions/[composite]` becomes a redirect. No seed buttons carried over.

## Phase 5 — Terrain runtime (C++)

- **Colors**: add background codes to `TextHelperFunctions::Colorize` (`{x`..`{w` → `\033[4Xm`/`\033[10Xm`, `{n` reset-bg); `TerrainDef` gains `bg_color`; `LoadTerrain`/`floor_palette` loader reads it; `NetworkSyncSystem` grid emit uses `fg + bg` combined string (existing color-transition diff keeps working). xterm.js supports ANSI bg natively — no client change.
- **blocks_move**: enforce in `WorldManager::CanMoveTo` (WorldManager.cpp:155) via `GetTerrainFor(char, region).blocks_move` — today only `terrainId < 0` (void) blocks.
- **blocks_sight**: add a basic Bresenham line-of-sight filter in `NetworkSyncSystem`'s grid build (cells without LOS from the player render as unseen); no FOV system exists today.
- **move_cost**: steps onto tiles with move_cost > 1 cost extra stamina (move_cost - 1); exact pool wiring confirmed against the existing stamina system during implementation.
- **description**: load `description` into `TerrainDef` from entities (field exists in C++, never populated) and show it on `examine <tile>`.
- Verified with the C++ build; note pushing to `main` deploys prod — server changes ship as a deliberate bump.

## Phase 6 — Drift fixes + custom editor repairs

C++ (reads current doc keys; DB already holds backfilled shape — no data migration):
- `RoomFactory.cpp`: read `spawn_x`/`spawn_y` (fallback `spawn{x,y}`) — admin-saved rooms' spawn currently silently ignored (RoomFactory.cpp:170)
- `SkillFactory.cpp`: read `category_id` (fallback `category`) — all skills currently get empty category
- `MobFactory.cpp`: fix `extra` assignment overwriting `components` so mob components survive

Admin:
- `ScriptPicker.vue`: fix `pick()` writing literal `'on_enter'` instead of the picked path
- Mob editor: `attack_patterns` via EntityArrayField, proper `stat` sub-fields; RoomEditor: preserve + expose `floor_legend`
- `MetaEditor.vue`: dark-theme restyle (light gray-700 outlier today)

## Phase 7 — API integrity + bug sweep

- `deleteEntity`: referenced-by scan across known ref fields (mob.loot_drop, loot_table.entries[].id, recipe.skill_id/inputs/outputs, shop.mob_id/inventory, faction.relations, room.spawns[].template_id, exits.target_room, item weapon.defaultSkill/passive_skills); UI confirm shows what links in
- `/api/overview/stats`: rooms counted from entities (card always 0 today); exits/spawns from room docs (currently query legacy tables dropped by migration 30)
- `/api/search/entities`: room + region branches read `world.entities` (currently query dropped tables)
- `wikiParser.ts`: add the 8 missing types (terrain, dialogue, faction, class, race, shop, board, skill_category) to EntityType/knownTypes/ENTITY_COLORS/ENTITY_ICONS; `entityHref` → `/entities/{type}/{id}` directly; WorldTree + admin hrefs de-stubbed (stubs remain for old bookmarks)

## Phase 8 — Docs

Update `MudAdmin/AGENTS.md` (editor architecture, schema registry as source of truth, widget vocabulary, terrain color codes) and mark UI_REMAKE_PLAN phases 2-3 absorbed.

## Follow-ups (out of scope)

- Converging the 7 custom editors into the engine (LayoutPainter, exits table, component cards as pluggable widgets)
- Server consumption of quest/class/race/board docs (loaded-but-unused or Lua-only)
- Sidebar IA / overview restyle (UI_REMAKE_PLAN phases 1/4) — touched only where editor work requires