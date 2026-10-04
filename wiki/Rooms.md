# Room Requirements

A room is the smallest navigable unit in the world. Players stand in a cell of a room's grid; rooms connect to other rooms via exits. This document is the contract a builder agrees to before a room is considered shippable.

## Storage

A room is one row in `world.world_rooms`:

| Column | Type | Required | Notes |
|---|---|---|---|
| `region_id` | `text` | yes | Composite PK half; FK target is `world_regions.id` (no DB-level FK today; enforced by the admin). |
| `room_id` | `integer` | yes | Composite PK half; **region-scoped, unique**. See "ID assignment" below. |
| `name` | `text` | yes | Short noun phrase. Shown in `look`, the map, GMCP `Room.Info`, and inventory prompts. |
| `description` | `text` | no | Long-form prose; supports `[[type:id]]` wiki links. |
| `terrain` | `text` | no | Display hint for the per-region palette. Free-form string. |
| `width` | `integer` | yes (>=1) | Grid columns. |
| `height` | `integer` | yes (>=1) | Grid rows. |
| `layout_json` | `jsonb/text` | yes | Array of `height` strings, each exactly `width` chars. Each char references a `world_terrains.symbol`. |
| `spawn_x` | `integer` | no | Pixel-style grid coords (default `null`). Used by clients that draw the room as a mini-map. |
| `spawn_y` | `integer` | no | Same. |
| `scripts_json` | `jsonb/text` | no | Per-room Lua entry points. See [[Database]] for shape. |
| `extra_json` | `jsonb/text` | no | Free-form extension bag. |

The composite PK `(region_id, room_id)` means **two rooms in the same region cannot share an id, but the same id may be reused across regions**. `floor1::5` and `floor2::5` are different rooms.

## ID assignment

Room IDs are **per-region positive integers**, contiguous or sparse. The admin's `+ Add room` button (per region page) calls `GET /api/rooms/next-free-id` to compute a suggestion. The algorithm is:

1. If `from_room_id` is provided (the user was editing room N and clicked "add next door"), suggest `N + 1`.
2. Else if the region has no rooms, suggest `1`.
3. Else suggest `max(room_id) + 1`.
4. If `max + 1` collides (rare; only happens after a bulk delete), scan for the first gap.
5. If `max + 1` exceeds `2_147_483_647` (int32 limit) or is unsafe, fall back to the highest first-gap below.

The builder can override the suggestion. If the override collides, the admin shows a red banner naming the existing room and disables the submit button. On submit, the server's `POST /api/tables/world_rooms` enforces uniqueness at the DB level and returns `409 Conflict` with `{ existing: { id, name } }` if the row already exists.

**Hard limits**: room IDs must fit in Postgres `integer` (-2,147,483,648 to 2,147,483,647). The admin caps the input to the positive half. The lowest sensible floor is `1` — `0` and negative values are reserved for "no room" sentinels in the C++ server.

**Soft conventions**:
- Builders keep rooms in a region **contiguous** (1, 2, 3, …) for readability and so exits can use small integers.
- `room_id = 1` is the **default spawn room** for any player whose saved position is missing or invalid. Every region meant to be entered by players **must have a room with `room_id = 1`**, otherwise the C++ server logs "Unable to place … defaulting to room 1" and drops the player at the origin (entity id 0).
- After a bulk renumber, the admin's `Open map` view will rebuild layout from the new IDs. Rebuild spawn points (`world_room_spawns.room_id`) and exits (`world_room_exits.from_room_id`/`to_room_id`) by hand — there is no cascade.

## Layout grid

`layout_json` is a JSON array of exactly `height` strings, each of exactly `width` characters. Each character is a `symbol` from `world_terrains`. Symbols not present in `globalTerrain` (the runtime cache populated from `world_terrains` at boot) render as `&x` (void) — see [[Database#Terrains]].

Common conventions:
- `.` = walkable floor
- `#` = wall (blocks_move = 1)
- `T` = tree
- `~` = water
- space ` ` = unwalkable / void

**The row-width mismatch banner** in the room editor catches the common mistake of typing rows shorter or longer than `width`. A row shorter than `width` is padded with `-1` (void) at parse time (`ModularMudServer/RoomFactory.cpp:215`).

## Exits

Exits are rows in `world_room_exits`:
- `from_room_id` = the room you start in
- `direction` = one of `north|south|east|west|up|down`
- `to_room_id` = the room you end up in
- `is_one_way` = 1 if reverse direction does not also exist as a row
- `is_portal` = 1 if the exit jumps region/area or teleports
- `portal_name` = the in-world name shown to players when `is_portal = 1` (e.g. `"Whispering Gate"`)
- `auto_trigger` = 1 if walking through the exit fires the destination's `on_enter` without prompting

A bidirectional N/S connection between rooms A and B can be modelled as two rows (`A.north→B`, `B.south→A`) or as one row with `is_one_way = 0` (the C++ server will register both directions automatically).

## Spawn points

`world_room_spawns` rows are x/y positions inside a room where a mob/item/interactable should be placed on region load. Each row has:
- `type` = `mob` | `item` | `interactable` | `npc`
- `template_id` = foreign key into the matching `world_mobs` / `world_items` / `world_interactables` table
- `x`, `y` = grid coords (0-indexed, must be `< width` / `< height`)
- `respawn_time` = seconds; `0` = no respawn
- `is_respawning` = 1 to use the respawn timer, 0 for static placement
- `override_json` = per-spawn stat/color overrides (e.g. a tougher "elite" variant of the same template)

The admin's Room 6 tab lays these out as a drag-paint overlay over the layout grid. **Spawns with no matching template produce no error at insert time — they only fail to materialize at region load**, with `[Spawn] Mob Template not found: <id>` logs from `World::ParseSpawns`. Always validate templates exist before saving a spawn row.

## Minimum viable room

A new region is shippable as soon as it has:
1. A row in `world_regions` with `id`, `name`, and (if tribal) `floor_tribe`.
2. At least one row in `world_rooms` with `room_id = 1`, matching `width`/`height`/`layout_json`, and a non-empty `name`.
3. The terrain symbols used in `layout_json` are all present in `world_terrains` (or in `world_regions.floor_palette_json`).

Players logging into a region missing any of (1)–(3) will be dropped at world origin.

## Future builder commands (planned)

These will be in-game / back-office builder commands (not yet implemented). Each must respect the constraints above:

- `@dig <name> <direction>` — creates a new room north/south/etc. of the current room, assigns the next free `room_id` (CoffeeMUD-style `from_room_id + 1`), and links the bidirectional exit automatically.
- `@tunnel <name>` — like `@dig` but in a chosen direction at server-specified coordinates.
- `@clone <src_room> [new_name]` — duplicates a room's layout, description, and exits into a new room with the next free id.
- `@renumber <region> <old> <new>` — moves a room's id; updates all `world_room_spawns.room_id` and `world_room_exits.from_room_id`/`to_room_id` references atomically. Refuses to clobber an existing id.
- `@reserve <count>` — creates N placeholder rooms (`name = ''`, empty layout) to claim an id range in advance. Renders as `reserved` (yellow) on the admin map.
- `@describe <room_id>` — sets `description` for a room by id from inside the room.

All in-game commands must eventually call the same `/api/tables/world_rooms` endpoint that the admin uses, so that the 409 collision behavior is uniform.