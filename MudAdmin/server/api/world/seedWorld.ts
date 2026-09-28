import { getPool } from '../../utils/db'

interface world{
    id: Number,
    name: string,
    description:string,
    
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ world_id?: string }>(event).catch(() => ({} as { world_id?: string }))
  const world_id = body?.world_id
  if (!world_id) {
    throw createError({ statusCode: 400, statusMessage: 'world_id is required' })
  }

  const pool = getPool()
  const countRes = await pool.query<{ c: string }>(
    `select count(*) as c from world.world_terrains where world_id = $1`,
    [world_id],
  )
  const count = Number(countRes.rows[0]?.c ?? 0)
  if (count >= 3) {
    return { seeded: 0, skipped: true, message: `World '${world_id}' already has ${count} tiles; seed skipped.` }
  }

  const existingRes = await pool.query<{ symbol: string }>(
    `select symbol from world.world_terrains where world_id = $1`,
    [world_id],
  )
  const existing = new Set(existingRes.rows.map((r) => r.symbol))

  const client = await pool.connect()
  try {
    await client.query('begin')
    let seeded = 0
    for (const r of STARTER_TILES) {
      if (existing.has(r.symbol)) continue
      await client.query(
        `insert into world.world_terrains (world_id, symbol, name, color, blocks_move, blocks_sight, move_cost)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [world_id, r.symbol, r.name, r.color, r.blocks_move, r.blocks_sight, r.move_cost],
      )
      seeded++
    }
    await client.query('commit')
    return { seeded, skipped: false, message: `Seeded ${seeded} starter tile(s) into '${world_id}'.` }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
})
