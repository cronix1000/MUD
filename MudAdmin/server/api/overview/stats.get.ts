import { getDb } from '../../utils/db'

export default defineEventHandler(() => {
  const db = getDb()
  const count = (sql: string, ...params: unknown[]) =>
    (db.prepare(sql).get(...params) as { c: number } | undefined)?.c ?? 0

  return {
    worlds: count(`select count(*) c from world_worlds`),
    regions: count(`select count(*) c from world_regions`),
    regions_static: count(`select count(*) c from world_regions where region_kind = 'static' or region_kind is null`),
    regions_instanced: count(`select count(*) c from world_regions where region_kind = 'instanced'`),
    regions_tutorial: count(`select count(*) c from world_regions where region_kind = 'tutorial'`),
    rooms: count(`select count(*) c from world_rooms`),
    exits: count(`select count(*) c from world_room_exits`),
    spawns: count(`select count(*) c from world_room_spawns`),
    mobs: count(`select count(*) c from world_mobs`),
    npc_mobs: count(`select count(*) c from world_mobs where ai = 'passive_npc'`),
    items: count(`select count(*) c from world_items`),
    interactables: count(`select count(*) c from world_interactables`),
    loot_tables: count(`select count(*) c from world_loot_tables`),
    skills: count(`select count(*) c from world_skills`),
    quests: count(`select count(*) c from world_quests`),
    recipes: count(`select count(*) c from world_recipes`),
    dialogues: count(`select count(*) c from world_dialogues`),
    players: count(`select count(*) c from players.player_players`),
  }
})
