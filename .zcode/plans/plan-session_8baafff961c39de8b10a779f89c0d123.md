# Group component headers into logical groups (ModularMudServer)

## Current state
- ~82 component headers sit flat in `ModularMudServer/`. An existing hand-maintained aggregate `Component.h` includes 61 of them; 12 TUs include that whole aggregate, and every other system hand-lists 5–14 overlapping component headers.
- `ClientComponent.h` includes `ClientConnection.h` (winsock / `Platform.h` / Telnet codec chain) just to hold a `ClientConnection*` — this drags Windows sockets headers into nearly every TU.
- `Component.h` pulls `nlohmann/json.hpp` (via `MetaComponent.h`) into its 12 consumers; `MobAttackComponent.h` pulls sol2/Lua.
- No precompiled header is configured in the vcxproj or CMakeLists.
- 12 component headers are dead code (never included anywhere).

## 1. Create 9 group headers (flat in the project root, following the existing `XxxComponents.h` naming)
Each group header: `#pragma once`, its member component includes (alphabetical), plus the standard headers its members rely on (`<string>`, `<vector>`, `<map>`, `<unordered_map>`, `<cstdint>`).

| Group header | Members |
|---|---|
| `MovementComponents.h` | `Direction.h`, `PositionComponent.h`, `MoveIntentComponent.h`, `SpatialGridComponent.h` |
| `WorldComponents.h` | `RoomComponents.h`, `ZoneComponents.h`, `ZoneClimateComponent.h`, `RegionComponent.h`, `PortalComponent.h` |
| `StatsComponents.h` | `StatModifier.h`, `StatComponent.h`, `BaseStatComponent.h`, `BaseStatsComponent.h`, `HealthComponent.h`, `StatModifierComponent.h`, `MasteryComponent.h`, `RenownFactionComponent.h`, `AfflictionComponent.h`, `BodyComponent.h` |
| `CombatComponents.h` | `Tags.h`, `BusyComponent.h`, `CombatStateComponent.h`, `AttackIntentComponent.h`, `CombatIntentComponent.h`, `SkillIntentComponent.h`, `SkillDefintionComponent.h`, `SkillHolderComponent.h`, `ResourceCostComponent.h`, `CoolDownDefinitionComponent.h`, `DamageScalingComponent.h`, `SkillWindupComponents.h`, `TargetingIntentComponent.h` |
| `InventoryComponents.h` | `EquipmentSlot.h`, `EquipmentSlotInfo.h`, `EquipmentComponent.h`, `ItemComponent.h`, `InventoryComponent.h`, `WeaponComponent.h`, `ArmourComponent.h`, `SocketComponent.h`, `WeightComponent.h`, `ValueComponent.h`, `OwnershipComponent.h`, `SetComponent.h`, `ChestComponent.h`, `LootDropComponent.h`, `CraftingStation.h`, `CraftIntentComponent.h`, `EquipItemIntentComponent.h`, `PickupItemIntentComponent.h`, `DropItemIntentComponent.h` |
| `ActorComponents.h` | `BehaviourType.h`, `BehaviourComponent.h`, `MobComponent.h`, `AmbientAIComponent.h`, `RespawnComponent.h` |
| `InteractableComponents.h` | `InteractableComponent.h`, `InteractableIntentComponent.h`, `InteractionOverrideComponent.h`, `LeverComponent.h`, `ShrineComponent.h`, `DoorComponent.h`, `ScriptComponent.h` |
| `PlayerComponents.h` | `PlayerComponent.h`, `PlayerVariablesComponent.h`, `PermissionComponent.h`, `ClassComponent.h`, `ClientComponent.h`, `PulseComponent.h`, `ScheduledEventComponent.h`, `DirtyFlagComponents.h` |
| `PresentationComponents.h` | `NameComponent.h`, `DescriptionComponent.h`, `VisualComponent.h`, `VoiceComponent.h`, `DialogueComponent.h` |

**Heavy-header policy** — two headers are never pulled into a group; consumers include them explicitly (they already do today): `MobAttackComponent.h` (sol2/Lua) and `MetaComponent.h` (nlohmann/json). This keeps the Lua and JSON parse cost confined to the TUs that actually use them.

## 2. Lighten `ClientComponent.h` (the big compile-time win)
Replace `#include "ClientConnection.h"` with a forward declaration (`struct ClientConnection;`) — the header only holds a pointer and its own `GameMessage`/queue members. This removes the winsock/`Platform.h` chain from almost every TU. Then add `#include "ClientConnection.h"` to the .cpp files that actually dereference `client->` (found by grep + build errors: MessageSystem, CombatSystem, LookCommandHandler, NetworkSystem, etc.).

## 3. Rewrite `Component.h`
`Component.h` becomes just the 9 group includes + `MetaComponent.h` — a superset of today's contents, so the 12 aggregate consumers (factories, ScriptManager, WorldManager, …) keep compiling unchanged while their include list stops being hand-maintained.

## 4. Migrate consumers (~40 files)
For each system/handler/factory .cpp and .h: replace the list of individual component includes with the smallest covering set of group headers (typically 1–3). Keep direct includes only for the heavy trio exceptions. Keep the AGENTS.md include-order convention (own header first, project headers alphabetical, then stdlib).

## 5. Self-containment fixes
- `StatComponent.h`: add `<string>` (currently relies on transitive includes).
- `BodyComponent.h`: add `<map>` (same).

## 6. Delete the 12 orphaned headers
Re-verify each with a grep for references first, then delete: `AggressiveAIComponenet.h`, `CoolDownComponenet.h`, `MutationComponent.h` (conflicting duplicate of `MutationType`/`BodyPart` — a redefinition landmine), `SpawnComponent.h`, `MessageComponent.h`, `SpatialGridComponent.h`… (note: `SpatialGridComponent` folds into `MovementComponents.h` per step 1 — final keep/delete list reconciled so nothing both grouped and deleted), `ProgressionComponent.h`, `TargetComponent.h`, `TalkingIntentComponent.h`, `ContainerComponent.h`, `Stat.h`, `VoiceLineComponent.h` (empty file). Remove their `ClInclude` entries from `ModularMudServer.vcxproj` (+ `.filters` if present).

## 7. Enable a precompiled header
- New `pch.h` (standard library headers + `Component.h`) and `pch.cpp` (`#include "pch.h"`).
- CMake: `target_precompile_headers(${PROJECT_NAME} PRIVATE pch.h)` — this is what CI/Linux builds use.
- vcxproj: project-level `<PrecompiledHeader>Use</PrecompiledHeader>` + `Create` on `pch.cpp`. If MSVC PCH causes winsock ordering trouble in networking TUs, fall back to CMake-only PCH and keep vcxproj unchanged.

## 8. Update docs + project files
- Add the 9 group headers + `pch.h/cpp` to `ModularMudServer.vcxproj` `ClInclude`/`ClCompile` (CMake's `file(GLOB)` picks them up automatically).
- `ModularMudServer/AGENTS.md`: update "Adding a Component" (add to the matching group header; `Component.h` aggregates the groups) and note the heavy-header exceptions.

## 9. Verify
Full Release build via MSBuild, then a CMake configure+build, fixing any missing-include fallout (expected: only `ClientConnection.h` additions from step 2).

## Expected effect
- Networking/winsock headers leave most translation units entirely (step 2 is the single biggest compile-time cut).
- sol2 and nlohmann/json stay confined to the TUs that use them.
- New components get one obvious home; system files go from 5–14 hand-listed component includes to 1–3 group includes.
- PCH makes remaining redundant per-TU parsing a one-time cost.