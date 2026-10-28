import { getPool } from '../../utils/db'

export default defineEventHandler(async () => {
  const pool = getPool()
  const count = async (sql: string, ...params: unknown[]) => {
    const res = await pool.query<{ c: string }>(sql, params)
    return Number(res.rows[0]?.c ?? 0)
  }
  const countEntities = async (type: string) =>
    count(`select count(*) as c from world.entities where entity_type = $1`, type)

  const roomContent = await pool.query<{ exits: string; spawns: string }>(
    `select
       coalesce(sum(case when jsonb_typeof(doc->'exits') = 'object' then jsonb_object_length(doc->'exits') else 0 end), 0) as exits,
       coalesce(sum(case when jsonb_typeof(doc->'spawns') = 'array' then jsonb_array_length(doc->'spawns') else 0 end), 0) as spawns
     from world.entities where entity_type = 'room'`,
  )

  return {
    regions: await countEntities('region'),
    rooms: await countEntities('room'),
    exits: Number(roomContent.rows[0]?.exits ?? 0),
    spawns: Number(roomContent.rows[0]?.spawns ?? 0),
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
