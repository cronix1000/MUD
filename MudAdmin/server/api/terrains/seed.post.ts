import { getPool } from '../../utils/db'

interface StarterTile {
  symbol: string
  name: string
  color: string
  blocks_move: 0 | 1
  blocks_sight: 0 | 1
  move_cost: number
}

const STARTER_TILES: StarterTile[] = [
  { symbol: '.', name: 'Floor',      color: '&Y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
  { symbol: '#', name: 'Wall',       color: '&x', blocks_move: 1, blocks_sight: 1, move_cost: 1 },
  { symbol: '~', name: 'Water',      color: '&b', blocks_move: 0, blocks_sight: 0, move_cost: 2 },
  { symbol: 'T', name: 'Tree',       color: '&g', blocks_move: 0, blocks_sight: 1, move_cost: 2 },
  { symbol: ',', name: 'Grass',      color: '&G', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
  { symbol: '^', name: 'Mountain',   color: '&D', blocks_move: 1, blocks_sight: 1, move_cost: 3 },
  { symbol: ':', name: 'Sand',       color: '&y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
  { symbol: "'", name: 'Flower',     color: '&m', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
  { symbol: '>', name: 'Stairs dn',  color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
  { symbol: '<', name: 'Stairs up',  color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
]

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
