import { listEntities, upsertEntity } from '../../utils/entities'

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

export default defineEventHandler(async () => {
  const existing = new Set((await listEntities('terrain', { limit: 500 })).map((r) => r.entity_id))
  if (existing.size >= 3) {
    return { seeded: 0, skipped: true, message: `Palette already has ${existing.size} tiles; seed skipped.` }
  }

  let seeded = 0
  for (const t of STARTER_TILES) {
    if (existing.has(t.symbol)) continue
    await upsertEntity('terrain', t.symbol, {
      symbol: t.symbol,
      name: t.name,
      color: t.color,
      blocks_move: t.blocks_move === 1,
      blocks_sight: t.blocks_sight === 1,
      move_cost: t.move_cost,
    })
    seeded++
  }
  return { seeded, skipped: false, message: `Seeded ${seeded} starter tile(s).` }
})
