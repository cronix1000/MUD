export interface CompositeKeySpec {
  fields: string[]
  encode: (row: Record<string, unknown>) => string
  decode: (raw: string) => Record<string, unknown>
}

export const COMPOSITE_KEYS: Record<string, CompositeKeySpec> = {
  world_rooms: {
    fields: ['region_id', 'room_id'],
    encode: (r) => `${r.region_id}::${r.room_id}`,
    decode: (raw) => {
      const [region_id, room_id] = decodeURIComponent(raw).split('::')
      if (!region_id || !room_id) {
        throw new Error(`Invalid composite key: ${raw}`)
      }
      const n = Number(room_id)
      if (!Number.isInteger(n)) {
        throw new Error(`Invalid room_id: ${room_id}`)
      }
      return { region_id, room_id: n }
    },
  },
  world_mobs: {
    fields: ['template_id'],
    encode: (r) => `${r.template_id}`,
    decode: (raw) => {
      const template_id = decodeURIComponent(raw)
      if (!template_id) throw new Error(`Invalid composite key: ${raw}`)
      return { template_id }
    },
  },
  world_items: {
    fields: ['template_id'],
    encode: (r) => `${r.template_id}`,
    decode: (raw) => {
      const template_id = decodeURIComponent(raw)
      if (!template_id) throw new Error(`Invalid composite key: ${raw}`)
      return { template_id }
    },
  },
  world_interactables: {
    fields: ['template_id'],
    encode: (r) => `${r.template_id}`,
    decode: (raw) => {
      const template_id = decodeURIComponent(raw)
      if (!template_id) throw new Error(`Invalid composite key: ${raw}`)
      return { template_id }
    },
  },
  world_terrains: {
    fields: ['symbol'],
    encode: (r) => `${r.symbol}`,
    decode: (raw) => {
      const symbol = decodeURIComponent(raw)
      if (symbol === undefined) throw new Error(`Invalid composite key: ${raw}`)
      return { symbol }
    },
  },
  world_loot_tables: {
    fields: ['table_id'],
    encode: (r) => `${r.table_id}`,
    decode: (raw) => {
      const table_id = decodeURIComponent(raw)
      if (!table_id) throw new Error(`Invalid composite key: ${raw}`)
      return { table_id }
    },
  },
  world_dialogues: {
    fields: ['node_id'],
    encode: (r) => `${r.node_id}`,
    decode: (raw) => {
      const node_id = decodeURIComponent(raw)
      if (!node_id) throw new Error(`Invalid composite key: ${raw}`)
      return { node_id }
    },
  },
  world_quests: {
    fields: ['quest_id'],
    encode: (r) => `${r.quest_id}`,
    decode: (raw) => {
      const quest_id = decodeURIComponent(raw)
      if (!quest_id) throw new Error(`Invalid composite key: ${raw}`)
      return { quest_id }
    },
  },
  world_quest_objectives: {
    fields: ['quest_id', 'ordinal'],
    encode: (r) => `${r.quest_id}::${r.ordinal}`,
    decode: (raw) => {
      const [quest_id, ordinal] = decodeURIComponent(raw).split('::')
      if (!quest_id || ordinal === undefined) throw new Error(`Invalid composite key: ${raw}`)
      const n = Number(ordinal)
      if (!Number.isInteger(n)) throw new Error(`Invalid ordinal: ${ordinal}`)
      return { quest_id, ordinal: n }
    },
  },
  world_quest_rewards: {
    fields: ['quest_id', 'ordinal'],
    encode: (r) => `${r.quest_id}::${r.ordinal}`,
    decode: (raw) => {
      const [quest_id, ordinal] = decodeURIComponent(raw).split('::')
      if (!quest_id || ordinal === undefined) throw new Error(`Invalid composite key: ${raw}`)
      const n = Number(ordinal)
      if (!Number.isInteger(n)) throw new Error(`Invalid ordinal: ${ordinal}`)
      return { quest_id, ordinal: n }
    },
  },
  world_recipes: {
    fields: ['recipe_id'],
    encode: (r) => `${r.recipe_id}`,
    decode: (raw) => {
      const recipe_id = decodeURIComponent(raw)
      if (!recipe_id) throw new Error(`Invalid composite key: ${raw}`)
      return { recipe_id }
    },
  },
  world_regions: {
    fields: ['id'],
    encode: (r) => `${r.id}`,
    decode: (raw) => {
      const id = decodeURIComponent(raw)
      if (!id) throw new Error(`Invalid composite key: ${raw}`)
      return { id }
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