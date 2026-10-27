// metaKeys.ts — single source of truth for typed `meta` keys.
//
// World-builders tune these via MudAdmin typed widgets. Coders add new
// keys here when a `meta.*` value becomes common across many entities.
// Each key has a type, default, and constraints.
//
// Promotion rule (see MudAdmin/AGENTS.md "proxy workflow"):
//   script-only default → raw meta key → registered key (here) → typed column
//
// Entities covered: room, mob, item, interactable. Keys are namespaced
// per entity type so a key like mob.respawn_seconds doesn't collide with
// item.respawn_seconds.

export type MetaKeyType = 'int' | 'float' | 'bool' | 'string' | 'enum' | 'array'

export interface MetaKeySpec {
  type: MetaKeyType
  default: number | boolean | string | string[]
  min?: number
  max?: number
  maxLen?: number
  values?: string[]
  itemMaxLen?: number
  label?: string
  help?: string
}

export type MetaKeyMap = Record<string, MetaKeySpec>

export const META_KEYS: Record<'mob' | 'room' | 'item' | 'interactable', MetaKeyMap> = {
  mob: {
    respawn_seconds:  { type: 'int',    default: 300, min: 0,    max: 86400, label: 'Respawn (seconds)' },
    respawn_variance: { type: 'int',    default: 60,  min: 0,    max: 3600,  label: 'Respawn variance' },
    aggro_radius:      { type: 'int',    default: 0,   min: 0,    max: 30,    label: 'Aggro radius' },
    xp_reward:         { type: 'int',    default: 0,   min: 0,    max: 100000,label: 'XP reward' },
    death_line:        { type: 'string', default: '',  maxLen: 200,            label: 'Death message' },
    taunt_on_hit:      { type: 'string', default: '',  maxLen: 200,            label: 'Taunt on hit' },
    faction:           { type: 'string', default: '',  maxLen: 50,             label: 'Faction tag' },
  },
  room: {
    is_safe:           { type: 'bool',   default: false,                          label: 'Safe zone (no PvP)' },
    light_level:       { type: 'int',    default: 0,    min: 0, max: 10,        label: 'Light level' },
    brawl_chance:      { type: 'float',  default: 0,    min: 0, max: 1,         label: 'Brawl chance per tick' },
    climate_tag:       { type: 'string', default: '',   maxLen: 30,             label: 'Climate tag override' },
    ambient_sound:     { type: 'string', default: '',   maxLen: 50,             label: 'Ambient sound key' },
  },
  item: {
    max_stack:         { type: 'int',    default: 1,    min: 1,    max: 999,  label: 'Max stack' },
    bind_on_pickup:    { type: 'bool',   default: false,                         label: 'Bind on pickup' },
    bind_on_equip:     { type: 'bool',   default: false,                         label: 'Bind on equip' },
    no_sell:           { type: 'bool',   default: false,                         label: 'Cannot be sold' },
    no_drop:           { type: 'bool',   default: false,                         label: 'Cannot be dropped' },
    durability:        { type: 'int',    default: 100,  min: 0,    max: 1000, label: 'Max durability' },
    required_level:    { type: 'int',    default: 1,    min: 1,    max: 100,  label: 'Required level' },
    rarity: {
      type: 'enum',
      default: 'common',
      values: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      label: 'Rarity',
    },
  },
  interactable: {
    cooldown_seconds:  { type: 'int',    default: 0, min: 0, max: 86400,         label: 'Cooldown (seconds)' },
    max_uses_per_player: { type: 'int',  default: -1, min: -1, max: 1000,        label: 'Max uses (-1 = unlimited)' },
    alchemy_circle_id: { type: 'string', default: '',  maxLen: 200, label: 'Alchemy circle (symbol)', help: 'The drawn symbol pattern that identifies this circle. Consumed by the C++ alchemy decoder to resolve heat, mana, element, and other qualities at runtime. Use the magic circle maker to author. Examples: @, @@c, &r@&rco.' },
  },
}

export type MetaEntityType = keyof typeof META_KEYS

export function isKnownKey(entityType: MetaEntityType, key: string): boolean {
  return key in META_KEYS[entityType]
}

export function getDefaults(entityType: MetaEntityType): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(META_KEYS[entityType])) {
    out[key] = spec.default
  }
  return out
}

export function coerceMetaValue(spec: MetaKeySpec, raw: unknown): unknown {
  switch (spec.type) {
    case 'int':
      return Math.trunc(Number(raw) || 0)
    case 'float':
      return Number(raw) || 0
    case 'bool':
      return raw === true || raw === 'true' || raw === 1 || raw === '1'
    case 'string':
      return raw === null || raw === undefined ? '' : String(raw)
    case 'enum':
      return raw === null || raw === undefined ? '' : String(raw)
    case 'array':
      if (Array.isArray(raw)) return raw.map((v) => v === null || v === undefined ? '' : String(v))
      if (raw === null || raw === undefined || raw === '') return [] as string[]
      return [String(raw)]
    default:
      return raw
  }
}

// Merge saved meta with registry defaults. Saved values win when valid;
// missing keys fall back to defaults. Unknown keys pass through
// (world-builder wrote them by hand — don't drop them).
export function mergeWithDefaults(
  entityType: MetaEntityType,
  saved: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const defaults = getDefaults(entityType)
  const merged: Record<string, unknown> = { ...defaults, ...(saved ?? {}) }
  return merged
}