export interface CompositeKeySpec {
  fields: string[]
  encode: (row: Record<string, unknown>) => string
  decode: (raw: string) => Record<string, unknown>
}

export const COMPOSITE_KEYS: Record<string, CompositeKeySpec> = {
  world_rooms: {
    fields: ['world_id', 'region_id', 'room_id'],
    encode: (r) => `${r.world_id}::${r.region_id}::${r.room_id}`,
    decode: (raw) => {
      const [world_id, region_id, room_id] = decodeURIComponent(raw).split('::')
      if (!world_id || !region_id || !room_id) {
        throw new Error(`Invalid composite key: ${raw}`)
      }
      const n = Number(room_id)
      if (!Number.isInteger(n)) {
        throw new Error(`Invalid room_id: ${room_id}`)
      }
      return { world_id, region_id, room_id: n }
    },
  },
  world_mobs: {
    fields: ['world_id', 'template_id'],
    encode: (r) => `${r.world_id}::${r.template_id}`,
    decode: (raw) => {
      const [world_id, template_id] = decodeURIComponent(raw).split('::')
      if (!world_id || !template_id) throw new Error(`Invalid composite key: ${raw}`)
      return { world_id, template_id }
    },
  },
  world_items: {
    fields: ['world_id', 'template_id'],
    encode: (r) => `${r.world_id}::${r.template_id}`,
    decode: (raw) => {
      const [world_id, template_id] = decodeURIComponent(raw).split('::')
      if (!world_id || !template_id) throw new Error(`Invalid composite key: ${raw}`)
      return { world_id, template_id }
    },
  },
  world_interactables: {
    fields: ['world_id', 'template_id'],
    encode: (r) => `${r.world_id}::${r.template_id}`,
    decode: (raw) => {
      const [world_id, template_id] = decodeURIComponent(raw).split('::')
      if (!world_id || !template_id) throw new Error(`Invalid composite key: ${raw}`)
      return { world_id, template_id }
    },
  },
  world_terrains: {
    fields: ['world_id', 'symbol'],
    encode: (r) => `${r.world_id}::${r.symbol}`,
    decode: (raw) => {
      const [world_id, symbol] = decodeURIComponent(raw).split('::')
      if (!world_id || symbol === undefined) throw new Error(`Invalid composite key: ${raw}`)
      return { world_id, symbol }
    },
  },
  world_loot_tables: {
    fields: ['world_id', 'table_id'],
    encode: (r) => `${r.world_id}::${r.table_id}`,
    decode: (raw) => {
      const [world_id, table_id] = decodeURIComponent(raw).split('::')
      if (!world_id || !table_id) throw new Error(`Invalid composite key: ${raw}`)
      return { world_id, table_id }
    },
  },
  world_dialogues: {
    fields: ['world_id', 'node_id'],
    encode: (r) => `${r.world_id}::${r.node_id}`,
    decode: (raw) => {
      const [world_id, node_id] = decodeURIComponent(raw).split('::')
      if (!world_id || !node_id) throw new Error(`Invalid composite key: ${raw}`)
      return { world_id, node_id }
    },
  },
  world_quests: {
    fields: ['world_id', 'quest_id'],
    encode: (r) => `${r.world_id}::${r.quest_id}`,
    decode: (raw) => {
      const [world_id, quest_id] = decodeURIComponent(raw).split('::')
      if (!world_id || !quest_id) throw new Error(`Invalid composite key: ${raw}`)
      return { world_id, quest_id }
    },
  },
  world_quest_objectives: {
    fields: ['world_id', 'quest_id', 'ordinal'],
    encode: (r) => `${r.world_id}::${r.quest_id}::${r.ordinal}`,
    decode: (raw) => {
      const [world_id, quest_id, ordinal] = decodeURIComponent(raw).split('::')
      if (!world_id || !quest_id || ordinal === undefined) throw new Error(`Invalid composite key: ${raw}`)
      const n = Number(ordinal)
      if (!Number.isInteger(n)) throw new Error(`Invalid ordinal: ${ordinal}`)
      return { world_id, quest_id, ordinal: n }
    },
  },
  world_quest_rewards: {
    fields: ['world_id', 'quest_id', 'ordinal'],
    encode: (r) => `${r.world_id}::${r.quest_id}::${r.ordinal}`,
    decode: (raw) => {
      const [world_id, quest_id, ordinal] = decodeURIComponent(raw).split('::')
      if (!world_id || !quest_id || ordinal === undefined) throw new Error(`Invalid composite key: ${raw}`)
      const n = Number(ordinal)
      if (!Number.isInteger(n)) throw new Error(`Invalid ordinal: ${ordinal}`)
      return { world_id, quest_id, ordinal: n }
    },
  },
  world_recipes: {
    fields: ['world_id', 'recipe_id'],
    encode: (r) => `${r.world_id}::${r.recipe_id}`,
    decode: (raw) => {
      const [world_id, recipe_id] = decodeURIComponent(raw).split('::')
      if (!world_id || !recipe_id) throw new Error(`Invalid composite key: ${raw}`)
      return { world_id, recipe_id }
    },
  },
  world_regions: {
    fields: ['world_id', 'id'],
    encode: (r) => `${r.world_id}::${r.id}`,
    decode: (raw) => {
      const [world_id, id] = decodeURIComponent(raw).split('::')
      if (!world_id || !id) throw new Error(`Invalid composite key: ${raw}`)
      return { world_id, id }
    },
  },
}

export function isCompositeKey(table: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMPOSITE_KEYS, table)
}

export function encodeCompositeKey(table: string, row: Record<string, unknown>): string {
  const spec = COMPOSITE_KEYS[table]
  if (!spec) throw new Error(`Table ${table} has no composite key spec`)
  return spec.encode(row)
}

export function decodeCompositeKey(table: string, raw: string): Record<string, unknown> {
  const spec = COMPOSITE_KEYS[table]
  if (!spec) throw new Error(`Table ${table} has no composite key spec`)
  return spec.decode(raw)
}
