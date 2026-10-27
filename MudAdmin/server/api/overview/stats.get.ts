import { getPool } from '../../utils/db'

export default defineEventHandler(async () => {
  const pool = getPool()
  const count = async (sql: string, ...params: unknown[]) => {
    const res = await pool.query<{ c: string }>(sql, params)
    return Number(res.rows[0]?.c ?? 0)
  }
  const countEntities = async (type: string) =>
    count(`select count(*) as c from world.entities where entity_type = $1`, type)

  return {
    regions: await countEntities('region'),
    exits: await count(`select count(*) as c from world.world_room_exits`),
    spawns: await count(`select count(*) as c from world.world_room_spawns`),
    mobs: await countEntities('mob'),
    npc_mobs: await count(`select count(*) as c from world.entities where entity_type = 'mob' and doc->>'ai' = 'passive_npc'`),
    items: await countEntities('item'),
    interactables: await countEntities('interactable'),
    loot_tables: await countEntities('loot_table'),
    skills: await countEntities('skill'),
    quests: await countEntities('quest'),
    recipes: await countEntities('recipe'),
    dialogues: await countEntities('dialogue'),
    players: await count(`select count(*) as c from players.player_players`),
  }
})
