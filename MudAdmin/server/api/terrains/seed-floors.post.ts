import { getPool } from '../../utils/db'

interface StarterTile {
  symbol: string
  name: string
  color: string
  blocks_move: 0 | 1
  blocks_sight: 0 | 1
  move_cost: number
}

interface FloorPalette {
  region_id: string
  floor_tribe: string
  floor_index: number
  biome_theme: string
  tiles: StarterTile[]
}

const FLOOR_PALETTES: FloorPalette[] = [
  {
    region_id: 'floor1_orcs',
    floor_tribe: 'orcs',
    floor_index: 1,
    biome_theme: 'sahara',
    tiles: [
      { symbol: '.', name: 'Cracked Sand',     color: '&y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '#', name: 'Scorched Wall',    color: '&x', blocks_move: 1, blocks_sight: 1, move_cost: 1 },
      { symbol: '~', name: 'Oasis Pool',       color: '&b', blocks_move: 0, blocks_sight: 0, move_cost: 2 },
      { symbol: 'T', name: 'Acacia',           color: '&D', blocks_move: 0, blocks_sight: 1, move_cost: 2 },
      { symbol: ',', name: 'Sun-bleached Dry', color: '&Y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '^', name: 'Stone Pillar',     color: '&D', blocks_move: 1, blocks_sight: 1, move_cost: 3 },
      { symbol: ':', name: 'Drift Sand',       color: '&y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: "'", name: 'Withered Bloom',   color: '&r', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '>', name: 'Stairs Down',      color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '<', name: 'Stairs Up',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '*', name: 'Soul Rot Zone',    color: '&R', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
    ],
  },
  {
    region_id: 'floor2_humans',
    floor_tribe: 'humans',
    floor_index: 2,
    biome_theme: 'wetland',
    tiles: [
      { symbol: '.', name: 'Boardwalk',        color: '&G', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '#', name: 'Mangrove Wall',    color: '&x', blocks_move: 1, blocks_sight: 1, move_cost: 1 },
      { symbol: '~', name: 'Marsh Water',      color: '&B', blocks_move: 0, blocks_sight: 0, move_cost: 2 },
      { symbol: 'T', name: 'Cypress',          color: '&g', blocks_move: 0, blocks_sight: 1, move_cost: 2 },
      { symbol: ',', name: 'Reed Grass',       color: '&G', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '^', name: 'Bronze Marker',    color: '&Y', blocks_move: 1, blocks_sight: 1, move_cost: 3 },
      { symbol: ':', name: 'Bog Muck',         color: '&D', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: "'", name: 'Lotus Bloom',      color: '&m', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '>', name: 'Stairs Down',      color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '<', name: 'Stairs Up',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '=', name: 'Dissipation Pad',  color: '&c', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
    ],
  },
  {
    region_id: 'floor3_angels',
    floor_tribe: 'angels',
    floor_index: 3,
    biome_theme: 'mountain',
    tiles: [
      { symbol: '.', name: 'Granite Path',     color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '#', name: 'Mountain Wall',    color: '&x', blocks_move: 1, blocks_sight: 1, move_cost: 1 },
      { symbol: '~', name: 'Snowmelt Stream',  color: '&c', blocks_move: 0, blocks_sight: 0, move_cost: 2 },
      { symbol: 'T', name: 'Pine',             color: '&g', blocks_move: 0, blocks_sight: 1, move_cost: 2 },
      { symbol: ',', name: 'Alpine Grass',     color: '&G', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '^', name: 'Stone Crucible',   color: '&W', blocks_move: 1, blocks_sight: 1, move_cost: 3 },
      { symbol: ':', name: 'Ash',              color: '&D', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: "'", name: 'Edelweiss',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '>', name: 'Stairs Down',      color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '<', name: 'Stairs Up',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: 's', name: 'Slurry Vat',       color: '&Y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
    ],
  },
  {
    region_id: 'floor4_monumentals',
    floor_tribe: 'monumentals',
    floor_index: 4,
    biome_theme: 'plain',
    tiles: [
      { symbol: '.', name: 'Stone Slab',       color: '&D', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '#', name: 'Boundary Wall',    color: '&x', blocks_move: 1, blocks_sight: 1, move_cost: 1 },
      { symbol: '~', name: 'Slow Canal',       color: '&B', blocks_move: 0, blocks_sight: 0, move_cost: 2 },
      { symbol: 'T', name: 'Wide Oak',         color: '&g', blocks_move: 0, blocks_sight: 1, move_cost: 2 },
      { symbol: ',', name: 'Tall Grass',       color: '&G', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '^', name: 'Residue Heap',     color: '&Y', blocks_move: 1, blocks_sight: 1, move_cost: 3 },
      { symbol: ':', name: 'Loam',             color: '&y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: "'", name: 'Thistle',          color: '&m', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '>', name: 'Stairs Down',      color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '<', name: 'Stairs Up',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '+', name: 'Gateway',          color: '&Y', blocks_move: 0, blocks_sight: 1, move_cost: 1 },
    ],
  },
  {
    region_id: 'floor5_faery',
    floor_tribe: 'faery',
    floor_index: 5,
    biome_theme: 'swamp',
    tiles: [
      { symbol: '.', name: 'Black Peat',       color: '&m', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '#', name: 'Bone Wall',        color: '&X', blocks_move: 1, blocks_sight: 1, move_cost: 1 },
      { symbol: '~', name: 'Bog Water',        color: '&x', blocks_move: 0, blocks_sight: 0, move_cost: 2 },
      { symbol: 'T', name: 'Dead Cypress',     color: '&D', blocks_move: 0, blocks_sight: 1, move_cost: 2 },
      { symbol: ',', name: 'Wet Sedge',        color: '&m', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '^', name: 'Corpse Pillar',    color: '&D', blocks_move: 1, blocks_sight: 1, move_cost: 3 },
      { symbol: ':', name: 'Black Mud',        color: '&x', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: "'", name: 'Corpse Lily',      color: '&r', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '>', name: 'Stairs Down',      color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '<', name: 'Stairs Up',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '!', name: 'Decay Site',       color: '&R', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
    ],
  },
  {
    region_id: 'floor6_devils',
    floor_tribe: 'devils',
    floor_index: 6,
    biome_theme: 'desert',
    tiles: [
      { symbol: '.', name: 'Glare Sand',       color: '&Y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '#', name: 'Quartz Wall',      color: '&x', blocks_move: 1, blocks_sight: 1, move_cost: 1 },
      { symbol: '~', name: 'Heat Mirage',      color: '&r', blocks_move: 0, blocks_sight: 0, move_cost: 2 },
      { symbol: 'T', name: 'Petrified Tree',   color: '&D', blocks_move: 0, blocks_sight: 1, move_cost: 2 },
      { symbol: ',', name: 'Sun-baked Tuft',   color: '&y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '^', name: 'Cinnabar Spire',   color: '&R', blocks_move: 1, blocks_sight: 1, move_cost: 3 },
      { symbol: ':', name: 'Mirror Glass',     color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: "'", name: 'Desert Rose',      color: '&m', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '>', name: 'Stairs Down',      color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '<', name: 'Stairs Up',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '%', name: 'Inner Flame',      color: '&R', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
    ],
  },
  {
    region_id: 'floor7_jinn',
    floor_tribe: 'jinn',
    floor_index: 7,
    biome_theme: 'tundra_volcano',
    tiles: [
      { symbol: '.', name: 'White Ash',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '#', name: 'Obsidian Wall',    color: '&x', blocks_move: 1, blocks_sight: 1, move_cost: 1 },
      { symbol: '~', name: 'Magma Seam',       color: '&R', blocks_move: 0, blocks_sight: 0, move_cost: 2 },
      { symbol: 'T', name: 'Charred Stump',    color: '&x', blocks_move: 0, blocks_sight: 1, move_cost: 2 },
      { symbol: ',', name: 'Bone Snow',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '^', name: 'Ember Monolith',   color: '&R', blocks_move: 1, blocks_sight: 1, move_cost: 3 },
      { symbol: ':', name: 'Frost Crust',      color: '&c', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: "'", name: 'Survivor Lamp',    color: '&Y', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '>', name: 'Stairs Down',      color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '<', name: 'Stairs Up',        color: '&W', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
      { symbol: '#', name: 'Tyrn Crucible',    color: '&R', blocks_move: 0, blocks_sight: 0, move_cost: 1 },
    ],
  },
]

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

export default defineEventHandler(async () => {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const summary: Array<{ region_id: string; tiles: number; created: boolean }> = []
    let createdRegions = 0

    for (const palette of FLOOR_PALETTES) {
      const deduped = uniq(palette.tiles)
      const paletteJson = JSON.stringify(deduped)

      const existingRegion = await client.query<{ id: string }>(
        `select id from world.world_regions where id = $1`,
        [palette.region_id],
      )

      if (existingRegion.rowCount === 0) {
        await client.query(
          `insert into world.world_regions
             (id, name, description, region_kind, floor_tribe, floor_index,
              biome_theme, floor_palette_json)
           values ($1, $2, $3, 'static', $4, $5, $6, $7)`,
          [
            palette.region_id,
            palette.region_id.replace(/^floor\d_/, '').replace(/_/g, ' '),
            `Starter floor ${palette.floor_index} (${palette.floor_tribe})`,
            palette.floor_tribe,
            palette.floor_index,
            palette.biome_theme,
            paletteJson,
          ],
        )
        createdRegions++
        summary.push({ region_id: palette.region_id, tiles: deduped.length, created: true })
      } else {
        await client.query(
          `update world.world_regions
              set floor_tribe = $2,
                  floor_index = $3,
                  biome_theme = $4,
                  floor_palette_json = $5
            where id = $1`,
          [
            palette.region_id,
            palette.floor_tribe,
            palette.floor_index,
            palette.biome_theme,
            paletteJson,
          ],
        )
        summary.push({ region_id: palette.region_id, tiles: deduped.length, created: false })
      }
    }

    await client.query('commit')
    return {
      ok: true,
      created_regions: createdRegions,
      regions: summary,
      message:
        `Seeded ${createdRegions} new floor region(s); ` +
        `updated ${summary.length - createdRegions} existing. ` +
        `${summary.length} palette(s) total.`,
    }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
})
