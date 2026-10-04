# Zones — Plan

## Goal

Add a "zone" as a numbered, rule-bearing partition inside a region. Each room belongs to exactly one zone. Zones carry rule flags (PvP, magic, recall, respawn, etc.) as a free-form JSON bag, support per-zone wiki links, and can be marked procedural so their rooms are generated per-instance (per player first time, with party sharing) by an existing Lua generator rather than persisted to Postgres.

Reference model: CircleMUD/DikuMUD numbered zones. The wire protocol already documents a `zone` field in `Room.Info` (`docs/GMCP.md:161`) but nothing currently emits or stores one.

## Decisions (locked in)

| Question | Decision |
|---|---|
| Base model | Diku-style numbered zones (regions → zones → rooms) |
| Zone id shape | Integer per region (`(region_id, zone_id)` composite key) |
| Rule flags v1 | PvP + movement rules; respawn is free-form JSON; wiki-resolved + cross-zone links |
| Procedural rooms | Generated per entry, never persisted |
| Procedural trigger | Per player / party — `instance_scope` rules key controls it |
| Rules storage | One `rules_json` column |
| Climate interaction | Leave climate keyed by region for now (defer to a future change) |
| Wiki + nav in v1 | Yes, wire it everywhere |

## Data model

### New: `world.world_zones`

```
region_id      TEXT      -- parent region (FK world_regions.id, NOT enforced)
zone_id        INT       -- per-region zone number (Diku style)
name           TEXT      -- human-readable label
description    TEXT      -- wiki text
rules_json     TEXT      -- {pvp, magic, recall, respawn, ambient, notes, instance_scope, ...}
zone_script_ref TEXT     -- path under ModularMudServer/scripts/regions/zones/<ref>.lua (optional)
                            -- NULL = static (rooms live in world_rooms)
                            -- set = procedural (no DB rows for rooms; generator runs on first entry)
is_active      BOOL      -- soft toggle
created_at     TIMESTAMP
PRIMARY KEY (region_id, zone_id)
```

Composite key mirrors `world_rooms`. JSON passthrough: `LoadZoneJson` synthesizes `outZone["regionId"]`/`outZone["zoneId"]` like the existing room path (`ModularMudServer/PostgresDatabase.cpp:787`).

### Modified: `world.world_rooms`

```
ADD COLUMN zone_id INT NOT NULL DEFAULT 0
```

`zone_id=0` is the default (legacy "no zone" sentinel) so existing rooms continue to work and the migration is zero-touch. Composite PK stays `(region_id, room_id)`; add a non-unique index `(region_id, zone_id)` for per-zone lookups. No FK constraint — `zone_id=0` rows legitimately have no zone row.

### Rules JSON shape (v1)

```json
{
  "pvp": "safe",
  "magic": "open",
  "recall": "allow",
  "summon": "block",
  "respawn": { "rate": 1800, "capacity": 5 },
  "ambient": { "light": "dim", "weather": "none" },
  "instance_scope": "shared",
  "notes": "Free-form worldbuilding notes"
}
```

`instance_scope` values: `"shared"` (default), `"per_player"`. `"per_party"` is honored in the schema but falls back to `"shared"` until a party system exists.

Admins edit through a JSON textarea in the MudAdmin zone editor with a typed-form tab on top for the common keys. Extending later = bump a version key inside the JSON.

## C++ changes

### 1. New component — `ZoneIdentityComponent` — `ModularMudServer/ZoneComponents.h` (new file)

```cpp
struct ZoneIdentityComponent {
    std::string regionId;
    int zoneId = 0;
    std::string name;
    json rules;
    std::string zoneScriptRef;
    bool isInstanceSource = false;  // procedural flag
};
```

Registered alongside the other room components in the ECS world.

### 2. Modify `RoomIdentityComponent` — `ModularMudServer/RoomComponents.h:36-43`

Add fields:
```cpp
int zoneId = 0;        // 0 = no zone (legacy)
std::string zoneName;  // cached for GMCP + display
```

### 3. Modify `RoomFactory` — `ModularMudServer/RoomFactory.cpp`

`CreateRoomInternal` reads `zoneId`/`zoneName` from JSON (alongside `regionId` at line ~128). `CreateInstancedRoom` (line 31-97) inherits the template's `zoneId`/`zoneName`. The procedural path lives here: when a player crosses into a zone marked `isInstanceSource=true`, call `CreateInstancedRoom(templateRoomId)` per the existing flow.

### 4. Modify `PostgresDatabase.cpp`

- New `LoadZoneIds(regionId) -> vector<int>` (mirrors `LoadRoomIds` at line 751).
- New `LoadZoneJson(regionId, zoneId)` — `SELECT region_id, zone_id, name, description, rules_json, zone_script_ref, is_active FROM world_zones WHERE region_id=$1 AND zone_id=$2`.
- Modify `LoadRoomJson` SELECT (line 777-781) to include `zone_id`.
- Add `roomData["zoneId"] = zoneId` synthesis next to `outRoom["regionId"] = regionId` (line 787).
- `SavePlayer`/`LoadPlayer` are **not** touched — current zone is derived at lookup from the player's current room.

### 5. Modify `World::LoadRegion` — `ModularMudServer/World.cpp:69-136`

For each zone in the region:
1. If `zone_script_ref` is null → load DB rows via `LoadZoneJson` + `LoadRoomIds`, build static entities via `RoomFactory::CreateRoom` (current path).
2. If `zone_script_ref` is set → register only the entry room(s) (template rooms marked `isInstanceSource=true`), skip the rest. Generation happens on first player entry.

### 6. New system — `ZoneEntrySystem` — `ModularMudServer/ZoneEntrySystem.{h,cpp}` (new files)

Listens for player zone transitions (`OnPlayerChangedZone` already exists in `GameEngine.cpp:265-328`). On entering a procedural zone:

1. Look up `(regionId, zoneId)` in an in-memory cache keyed by `instance_scope`:
   - `"shared"` → `Map<pair<string,int>, vector<EntityID>>`
   - `"per_player"` → `Map<EntityID, Map<pair<string,int>, vector<EntityID>>>` keyed by player entity id
2. If no rooms → run the Lua generator (delegate to `ScriptManager::execute_hook(zoneScriptRef, config)`), then `RoomFactory::CreateInstancedRoom` for each generated room, then cache.
3. Wire the player into the entrance entity.

`"per_party"` is honored in the JSON but falls back to `"shared"` until a party system exists. The one comment I'd suggest adding flags this fallback so it's not silently broken later.

### 7. Modify `NetworkSystem` — `ModularMudServer/NetworkSystem.cpp:26-44`

Add to the `Room.Info` GMCP payload:
```cpp
{"region",   roomIdentity->regionId},
{"zone",     roomIdentity->zoneId},
{"zoneName", roomIdentity->zoneName}
```

This matches `docs/GMCP.md:161`.

### 8. Leave `WorldClimateSystem` alone

Climate remains region-keyed per decision. A TODO marker at the call site in `GameEngine.cpp:265-328` flags the future per-zone climate extension.

## Admin UI (MudAdmin)

### Migration — `MudAdmin/server/utils/migrate.ts`

Append migration 19:
```sql
CREATE TABLE world.world_zones (
  region_id TEXT NOT NULL,
  zone_id INTEGER NOT NULL,
  name TEXT,
  description TEXT,
  rules_json TEXT,
  zone_script_ref TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (region_id, zone_id)
);
ALTER TABLE world.world_rooms
  ADD COLUMN zone_id INTEGER NOT NULL DEFAULT 0;
CREATE INDEX world_rooms_region_zone_idx ON world.world_rooms (region_id, zone_id);
```

Apply against live DB through `/_migrate` after a `pg_dump` snapshot per AGENTS.md.

### Composite keys

Both copies must stay in lockstep:
- `MudAdmin/app/utils/composite-key.ts`
- `MudAdmin/server/utils/composite-key.ts`

Add:
```ts
world_zones: { fields: ['region_id','zone_id'], encode: `${z.region_id}::${z.zone_id}`, decode: split '::' }
```

### ALLOWED_TABLES — `MudAdmin/server/utils/db.ts:6-28`

Add `world_zones` to the set so the generic `/admin/world_zones` table page works automatically.

### Wiki parser — `MudAdmin/app/utils/wikiParser.ts`

Add `'zone'` to:
- `EntityType` (line 1)
- `entityHref()` switch (line 39-61)
- `ENTITY_COLORS` (line 63-73)
- `ENTITY_ICONS` (line 77-87)
- `knownTypes` (line 75)

Mirror in `MudAdmin/server/api/search/entities.get.ts:10,12-34`:
- `VALID_TYPES`
- `buildHref()` case

### New pages

- `/admin/world_zones` — generic card grid (auto via existing generic table page).
- `/admin/world_zones/[composite]` — new file `MudAdmin/app/pages/world/zones/[composite].vue`:
  - Identity tab: name, description (WikiText with `[[zone:id]]` preview).
  - Rules tab: JSON editor (left) + typed form (right) for the common keys.
  - Procedural tab: `zone_script_ref` picker (lists files under `ModularMudServer/scripts/regions/zones/`), preview button calling the existing stub-then-real preview endpoint.
- Region editor (`MudAdmin/app/pages/world/regions/[composite]/index.vue`) gets a "Zones" section listing child zones + a "+ New zone" button.
- Room editor (`MudAdmin/app/components/admin/RoomEditor.vue`) gets a `zone_id` picker on the Identity tab, filtered to zones of the room's region.

### Wiki rendering — `MudAdmin/app/components/WikiText.vue`

Resolve `[[zone:5]]` and `[[zone:floor1::5]]` to `/admin/world_zones/<composite>`.

### Nav tree — `MudAdmin/server/api/nav/tree.get.ts:1-22`

Extend the BFS to emit:
```
regions → zones → rooms
```

Existing rooms with `zone_id=0` stay at the region level so legacy layout isn't disturbed.

## Client (MudClient)

Minimal v1 change:

- New component `MudClient/components/widgets/ZoneBadge.vue` subscribed to `useGMCPStore().subscribe('Room.Info', ...)`, displays `zoneName` (or hides on `zoneId === 0`).
- `MudClient/composables/useMudSocket.ts:103` already subscribes to `Room.Info` — no change.
- No map widget — existing client is terminal-only.

## Wiki cross-zone links

- `MudAdmin/app/utils/wikiParser.ts` understands `[[zone:5]]` and `[[zone:floor1::5]]`.
- `MudAdmin/app/components/WikiText.vue` resolves `zone` hrefs to `/admin/world_zones/<composite>`.
- `MudAdmin/server/api/search/entities.get.ts` searches `world_zones` rows by name/description.

## Migration & rollout

1. Apply migration 19 against the live DB through `/_migrate` after a `pg_dump` snapshot, per AGENTS.md rule 6.
2. Boot the server with the new code. Existing rooms land at `zone_id=0`, behaving identically.
3. Manually assign `zone_id` values to existing rooms via SQL or via the new admin picker.
5. The procedural path is opt-in: zones without `zone_script_ref` behave exactly like today's rooms.

## Files touched

| Area | Files | Type |
|---|---|---|
| C++ new | `ModularMudServer/ZoneComponents.h`, `ModularMudServer/ZoneEntrySystem.{h,cpp}` | new |
| C++ modified | `ModularMudServer/RoomComponents.h`, `ModularMudServer/RoomFactory.{h,cpp}`, `ModularMudServer/PostgresDatabase.{h,cpp}`, `ModularMudServer/World.{h,cpp}`, `ModularMudServer/NetworkSystem.cpp`, `ModularMudServer/IDatabase.h` | modify |
| Migration | `MudAdmin/server/utils/migrate.ts` | append migration 19 |
| Composite keys | `MudAdmin/app/utils/composite-key.ts`, `MudAdmin/server/utils/composite-key.ts` | modify |
| Allowed tables | `MudAdmin/server/utils/db.ts` | modify |
| Wiki parser | `MudAdmin/app/utils/wikiParser.ts`, `MudAdmin/server/api/search/entities.get.ts` | modify |
| Wiki rendering | `MudAdmin/app/components/WikiText.vue` | modify |
| Pages | `MudAdmin/app/pages/world/zones/[composite].vue` | new |
| Pages | `MudAdmin/app/pages/world/regions/[composite]/index.vue` | modify (add Zones section) |
| Pages | `MudAdmin/app/components/admin/RoomEditor.vue` | modify (add zone_id picker) |
| Nav | `MudAdmin/server/api/nav/tree.get.ts` | modify |
| Client | `MudClient/components/widgets/ZoneBadge.vue` | new |
| Docs | `docs/GMCP.md` already documents the field | no change |

## Open questions deferred

1. **Party system** — does not exist. v1 supports `"shared"` and `"per_player"`; `"per_party"` falls back to `"shared"` at runtime with a single TODO marker. Adding real party support requires a separate plan.
2. **Flag vs script for procedural** — went with **both**: `zone_script_ref` is the default generator pointer, and a per-zone Lua file at that path can override generation. If you'd rather have only the script approach (no flag), drop `zone_script_ref` and require every procedural zone to embed a `scripts_json`-shaped Lua file.
3. **Comments** — none written by default per AGENTS.md rule 7. The one place I'd suggest adding a comment is the `instance_scope: per_party` fallback in `ZoneEntrySystem` so it isn't silently broken later. Confirm when implementing.