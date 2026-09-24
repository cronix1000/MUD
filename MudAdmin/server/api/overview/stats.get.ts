import { getPool } from '../../utils/db'

export default defineEventHandler(async () => {
  const pool = getPool()
  const count = async (sql: string, ...params: unknown[]) => {
    const res = await pool.query<{ c: string }>(sql, params)
    return Number(res.rows[0]?.c ?? 0)
  }

  return {
    worlds: await count(`select count(*) as c from world.world_worlds`),
    regions: await count(`select count(*) as c from world.world_regions`),
    regions_static: await count(`select count(*) as c from world.world_regions where region_kind = 'static' or region_kind is null`),
    regions_instanced: await count(`select count(*) as c from world.world_regions where region_kind = 'instanced'`),
    regions_tutorial: await count(`select count(*) as c from world.world_regions where region_kind = 'tutorial'`),
    rooms: await count(`select count(*) as c from world.world_rooms`),
    exits: await count(`select count(*) as c from world.world_room_exits`),
    spawns: await count(`select count(*) as c from world.world_room_spawns`),
    mobs: await count(`select count(*) as c from world.world_mobs`),
    npc_mobs: await count(`select count(*) as c from world.world_mobs where ai = 'passive_npc'`),
    items: await count(`select count(*) as c from world.world_items`),
    interactables: await count(`select count(*) as c from world.world_interactables`),
    loot_tables: await count(`select count(*) as c from world.world_loot_tables`),
    skills: await count(`select count(*) as c from world.world_skills`),
    quests: await count(`select count(*) as c from world.world_quests`),
    recipes: await count(`select count(*) as c from world.world_recipes`),
    dialogues: await count(`select count(*) as c from world.world_dialogues`),
    players: await count(`select count(*) as c from players.player_players`),
  }
})
