-- one-time-rename-world-tables.sql
-- Run once against mud_prod and mud_beta to align live table names with the
-- codebase expectation (world.worlds -> world.world_worlds, etc.).
--
-- Idempotent: every rename uses IF EXISTS so re-running is safe.
--
-- Run with:
--   docker exec -i mud-postgres psql -U postgres -d mud_prod < one-time-rename-world-tables.sql
--   docker exec -i mud-postgres psql -U postgres -d mud_beta  < one-time-rename-world-tables.sql

ALTER TABLE IF EXISTS world.worlds             RENAME TO world_worlds;
ALTER TABLE IF EXISTS world.regions            RENAME TO world_regions;
ALTER TABLE IF EXISTS world.rooms              RENAME TO world_rooms;
ALTER TABLE IF EXISTS world.room_exits         RENAME TO world_room_exits;
ALTER TABLE IF EXISTS world.room_spawns        RENAME TO world_room_spawns;
ALTER TABLE IF EXISTS world.mobs               RENAME TO world_mobs;
ALTER TABLE IF EXISTS world.items              RENAME TO world_items;
ALTER TABLE IF EXISTS world.interactables      RENAME TO world_interactables;
ALTER TABLE IF EXISTS world.skills             RENAME TO world_skills;
ALTER TABLE IF EXISTS world.skill_categories   RENAME TO world_skill_categories;
ALTER TABLE IF EXISTS world.terrains           RENAME TO world_terrains;
ALTER TABLE IF EXISTS world.dialogues          RENAME TO world_dialogues;
ALTER TABLE IF EXISTS world.loot_tables        RENAME TO world_loot_tables;
ALTER TABLE IF EXISTS world.quests             RENAME TO world_quests;
ALTER TABLE IF EXISTS world.quest_objectives   RENAME TO world_quest_objectives;
ALTER TABLE IF EXISTS world.quest_rewards      RENAME TO world_quest_rewards;
ALTER TABLE IF EXISTS world.recipes            RENAME TO world_recipes;
ALTER TABLE IF EXISTS world.field_definitions  RENAME TO world_field_definitions;
ALTER TABLE IF EXISTS world.region_overrides   RENAME TO world_region_overrides;
