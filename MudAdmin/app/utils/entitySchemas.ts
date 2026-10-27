export type EntityFieldType = 'text' | 'textarea' | 'number' | 'bool' | 'json' | 'script'

export interface EntityFieldSpec {
  key: string
  type: EntityFieldType
  label?: string
  default?: unknown
}

export interface EntitySchema {
  type: string
  label: string
  idLabel: string
  idPlaceholder?: string
  fields: EntityFieldSpec[]
}

const f = (key: string, type: EntityFieldType, label?: string): EntityFieldSpec => ({ key, type, label })

export const ENTITY_SCHEMAS: Record<string, EntitySchema> = {
  item: {
    type: 'item',
    label: 'Items',
    idLabel: 'template_id',
    idPlaceholder: 'iron_sword',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('char', 'text'), f('color', 'text'),
      f('value', 'number'), f('weight', 'number'), f('equippable', 'bool'), f('type', 'text'),
      f('script', 'script'), f('components', 'json'), f('meta', 'json'),
    ],
  },
  mob: {
    type: 'mob',
    label: 'Mobs',
    idLabel: 'template_id',
    idPlaceholder: 'goblin',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('char', 'text'), f('color', 'text'),
      f('hp', 'number'), f('level', 'number'), f('ai', 'text'), f('loot_drop', 'text'),
      f('attack_damage', 'number'), f('attack_speed', 'number'),
      f('critical_chance', 'number'), f('critical_multiplier', 'number'),
      f('dialogue_root', 'text'), f('script', 'script'), f('stat', 'json'),
      f('attack_patterns', 'json'), f('messages', 'json'), f('meta', 'json'),
    ],
  },
  interactable: {
    type: 'interactable',
    label: 'Interactables',
    idLabel: 'template_id',
    idPlaceholder: 'alchemy_circle',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('char', 'text'), f('color', 'text'),
      f('station_type', 'text'), f('script', 'script'), f('components', 'json'),
    ],
  },
  room: {
    type: 'room',
    label: 'Rooms',
    idLabel: 'region::room',
    idPlaceholder: 'floor1::3',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('region_id', 'text'), f('room_id', 'number'),
      f('terrain', 'text'), f('width', 'number'), f('height', 'number'),
      f('spawn_x', 'number'), f('spawn_y', 'number'), f('zone_id', 'number'),
      f('layout', 'json'), f('scripts', 'json'), f('exits', 'json'), f('spawns', 'json'),
      f('rules', 'json'), f('meta', 'json'),
    ],
  },
  region: {
    type: 'region',
    label: 'Regions',
    idLabel: 'region_id',
    idPlaceholder: 'floor1',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('theme', 'text'),
      f('floor_tribe', 'text'), f('biome_theme', 'text'),
      f('floor_settings', 'json'), f('floor_palette', 'json'), f('overrides', 'json'),
    ],
  },
  zone: {
    type: 'zone',
    label: 'Zones',
    idLabel: 'region::zone',
    idPlaceholder: 'floor1::1',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('region_id', 'text'),
      f('zone_id', 'number'), f('zone_script_ref', 'script'), f('is_active', 'bool'), f('rules', 'json'),
    ],
  },
  terrain: {
    type: 'terrain',
    label: 'Terrain',
    idLabel: 'symbol',
    idPlaceholder: '~',
    fields: [
      f('symbol', 'text'), f('name', 'text'), f('color', 'text'),
      f('blocks_move', 'bool'), f('blocks_sight', 'bool'), f('move_cost', 'number'),
    ],
  },
  dialogue: {
    type: 'dialogue',
    label: 'Dialogue',
    idLabel: 'node_id',
    idPlaceholder: 'blacksmith_root',
    fields: [
      f('text', 'textarea'), f('options', 'json'), f('idle', 'json'), f('combat', 'json'), f('death', 'json'),
    ],
  },
  skill: {
    type: 'skill',
    label: 'Skills',
    idLabel: 'skill_id',
    idPlaceholder: 'fireball',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('category_id', 'text'),
      f('type', 'text'), f('activation', 'text'), f('command', 'text'),
      f('cooldown', 'number'), f('windup', 'number'), f('targeting', 'text'), f('range', 'number'),
      f('script', 'script'), f('costs', 'json'), f('xp_curve', 'text'), f('xp_curve_params', 'json'),
    ],
  },
  skill_category: {
    type: 'skill_category',
    label: 'Skill categories',
    idLabel: 'category_id',
    idPlaceholder: 'combat',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('stats', 'json'), f('synergyBonus', 'number'),
    ],
  },
  loot_table: {
    type: 'loot_table',
    label: 'Loot tables',
    idLabel: 'table_id',
    idPlaceholder: 'goblin_common',
    fields: [f('name', 'text'), f('entries', 'json')],
  },
  recipe: {
    type: 'recipe',
    label: 'Recipes',
    idLabel: 'recipe_id',
    idPlaceholder: 'healing_potion',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('skill_id', 'text'),
      f('required_skill_level', 'number'), f('station_type', 'text'),
      f('outputs', 'json'), f('inputs', 'json'),
      f('craft_time_seconds', 'number'), f('experience_gain', 'number'),
      f('script', 'script'), f('is_auto_learned', 'bool'),
    ],
  },
  quest: {
    type: 'quest',
    label: 'Quests',
    idLabel: 'quest_id',
    idPlaceholder: 'newbie_move',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('script', 'script'),
      f('objectives', 'json'), f('rewards', 'json'),
    ],
  },
  faction: {
    type: 'faction',
    label: 'Factions',
    idLabel: 'faction_id',
    idPlaceholder: 'town_guard',
    fields: [f('name', 'text'), f('description', 'textarea'), f('ideology', 'text'), f('relations', 'json')],
  },
  class: {
    type: 'class',
    label: 'Classes',
    idLabel: 'class_id',
    idPlaceholder: 'warrior',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('primary_stat', 'text'),
      f('hp_per_level', 'number'), f('mp_per_level', 'number'),
    ],
  },
  race: {
    type: 'race',
    label: 'Races',
    idLabel: 'race_id',
    idPlaceholder: 'human',
    fields: [
      f('name', 'text'), f('description', 'textarea'),
      f('str_bonus', 'number'), f('dex_bonus', 'number'), f('int_bonus', 'number'),
      f('con_bonus', 'number'), f('wis_bonus', 'number'), f('cha_bonus', 'number'),
    ],
  },
  shop: {
    type: 'shop',
    label: 'Shops',
    idLabel: 'keeper_id',
    idPlaceholder: 'blacksmith_shop',
    fields: [
      f('mob_id', 'text'), f('shop_type', 'text'), f('markup', 'number'), f('markdown', 'number'),
      f('open_hour', 'number'), f('close_hour', 'number'), f('inventory', 'json'),
    ],
  },
  board: {
    type: 'board',
    label: 'Boards',
    idLabel: 'board_id',
    idPlaceholder: 'town_square',
    fields: [
      f('name', 'text'), f('description', 'textarea'), f('region_id', 'text'),
      f('max_posts', 'number'), f('read_perm', 'number'), f('write_perm', 'number'),
    ],
  },
}

export const ENTITY_TYPES = Object.keys(ENTITY_SCHEMAS)

export function isEntityType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENTITY_SCHEMAS, type)
}
