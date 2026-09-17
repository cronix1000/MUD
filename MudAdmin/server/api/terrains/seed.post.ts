import { getDb } from '../../utils/db'

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

  const db = getDb()
  const count = (db.prepare(`select count(*) as c from world_terrains where world_id = ?`).get(world_id) as { c: number }).c
  if (count >= 3) {
    return { seeded: 0, skipped: true, message: `World '${world_id}' already has ${count} tiles; seed skipped.` }
  }

  const insert = db.prepare(
    `insert into world_terrains (world_id, symbol, name, color, blocks_move, blocks_sight, move_cost) values (?, ?, ?, ?, ?, ?, ?)`,
  )
  let seeded = 0
  const existing = new Set(
    (db.prepare(`select symbol from world_terrains where world_id = ?`).all(world_id) as Array<{ symbol: string }>).map((r) => r.symbol),
  )
  const tx = db.transaction((rows: StarterTile[]) => {
    for (const r of rows) {
      if (existing.has(r.symbol)) continue
      insert.run(world_id, r.symbol, r.name, r.color, r.blocks_move, r.blocks_sight, r.move_cost)
      seeded++
    }
  })
  tx(STARTER_TILES)
  return { seeded, skipped: false, message: `Seeded ${seeded} starter tile(s) into '${world_id}'.` }
})
