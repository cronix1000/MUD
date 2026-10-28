export type ScriptKind = 'room' | 'quest' | 'interactable' | 'mob' | 'system' | 'skills' | 'items' | 'region'

export type EntityFieldWidget =
  | 'text' | 'textarea' | 'number' | 'bool' | 'select'
  | 'color' | 'bgcolor' | 'script' | 'ref' | 'wikitext'
  | 'array' | 'map' | 'group' | 'json'

export interface EntityArrayColumnSpec {
  key: string
  label?: string
  widget: 'text' | 'number' | 'select' | 'wiki' | 'color' | 'bgcolor'
  options?: Array<{ value: string; label: string }>
  step?: number
  min?: number
  placeholder?: string
}

export interface EntityMapValueFieldSpec {
  key: string
  label?: string
  widget: 'number' | 'text' | 'bool'
  step?: number
  min?: number
}

export interface EntityFieldSpec {
  key: string
  widget: EntityFieldWidget
  label?: string
  help?: string
  required?: boolean
  min?: number
  max?: number
  step?: number
  placeholder?: string
  span?: 1 | 2
  options?: Array<{ value: string; label: string }>
  refType?: string
  scriptKind?: ScriptKind
  columns?: EntityArrayColumnSpec[]
  addLabel?: string
  mapKeyLabel?: string
  mapKeyRefType?: string
  mapValue?: 'number' | 'text' | 'json' | 'fields'
  mapValueFields?: EntityMapValueFieldSpec[]
  fields?: EntityFieldSpec[]
}

export interface EntitySection {
  title: string
  fields: EntityFieldSpec[]
}

export interface EntitySchema {
  type: string
  label: string
  singular: string
  idLabel: string
  idPlaceholder?: string
  sections: EntitySection[]
  listMode?: 'table' | 'palette'
  editorNote?: string
}

const f = (key: string, widget: EntityFieldWidget, extra: Partial<EntityFieldSpec> = {}): EntityFieldSpec => ({
  key,
  widget,
  ...extra,
})

const NOT_READ = 'Not read by the server yet'

export const ENTITY_SCHEMAS: Record<string, EntitySchema> = {
  item: {
    type: 'item',
    label: 'Items',
    singular: 'Item',
    idLabel: 'template_id',
    idPlaceholder: 'iron_sword',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('type', 'text', { placeholder: 'misc', help: 'Overridden to weapon/armour by components' }),
          f('char', 'text', { placeholder: '(' }),
          f('color', 'color'),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Properties',
        fields: [
          f('value', 'number', { min: 0 }),
          f('weight', 'number', { min: 0, step: 0.1 }),
          f('equippable', 'bool'),
        ],
      },
      {
        title: 'Scripting',
        fields: [
          f('script', 'script', { scriptKind: 'items', help: NOT_READ + ' — use components.scripts' }),
        ],
      },
      {
        title: 'Advanced',
        fields: [
          f('components', 'json', { span: 2, help: 'Typed component cards in the item editor' }),
          f('meta', 'json', { span: 2 }),
        ],
      },
    ],
  },
  mob: {
    type: 'mob',
    label: 'Mobs',
    singular: 'Mob',
    idLabel: 'template_id',
    idPlaceholder: 'goblin',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('ai', 'select', {
            options: [
              { value: 'aggressive', label: 'Aggressive' },
              { value: 'passive', label: 'Passive' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'boss', label: 'Boss' },
            ],
          }),
          f('char', 'text', { placeholder: 'm' }),
          f('color', 'color'),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Combat',
        fields: [
          f('hp', 'number', { min: 1 }),
          f('level', 'number', { min: 1 }),
          f('attack_damage', 'number', { min: 0 }),
          f('attack_speed', 'number', { min: 0, step: 0.1 }),
          f('critical_chance', 'number', { min: 0, max: 1, step: 0.05 }),
          f('critical_multiplier', 'number', { min: 1, step: 0.1 }),
        ],
      },
      {
        title: 'Stats',
        fields: [
          f('stat', 'group', {
            fields: [
              f('strength', 'number', { min: 0 }),
              f('dexterity', 'number', { min: 0 }),
              f('intelligence', 'number', { min: 0 }),
            ],
          }),
        ],
      },
      {
        title: 'Behaviour',
        fields: [
          f('loot_drop', 'ref', { refType: 'loot_table', label: 'Loot table' }),
          f('dialogue_root', 'ref', { refType: 'dialogue', help: NOT_READ }),
          f('script', 'script', { scriptKind: 'mob' }),
          f('attack_patterns', 'array', {
            span: 2,
            addLabel: '+ Add attack pattern',
            columns: [
              { key: 'verb', widget: 'text', placeholder: 'attacks' },
              { key: 'multiplier', widget: 'number', step: 0.1, min: 0 },
              { key: 'damage_type', widget: 'text', placeholder: 'physical' },
            ],
          }),
        ],
      },
      {
        title: 'Advanced',
        fields: [
          f('messages', 'json', { span: 2 }),
          f('meta', 'json', { span: 2, help: 'respawn_seconds, aggro_radius, xp_reward, …' }),
        ],
      },
    ],
  },
  interactable: {
    type: 'interactable',
    label: 'Interactables',
    singular: 'Interactable',
    idLabel: 'template_id',
    idPlaceholder: 'alchemy_circle',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('char', 'text', { placeholder: '?' }),
          f('color', 'color'),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Behaviour',
        fields: [
          f('station_type', 'text', { help: NOT_READ }),
          f('script', 'script', { scriptKind: 'interactable' }),
        ],
      },
      {
        title: 'Advanced',
        fields: [
          f('components', 'json', { span: 2, help: 'Typed component cards in the interactable editor' }),
        ],
      },
    ],
  },
  room: {
    type: 'room',
    label: 'Rooms',
    singular: 'Room',
    idLabel: 'region::room',
    idPlaceholder: 'floor1::3',
    editorNote: 'Rooms use the dedicated room editor with layout painter, exits and spawns.',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('region_id', 'ref', { refType: 'region', required: true }),
          f('room_id', 'number', { required: true, min: 0 }),
          f('zone_id', 'number', { min: 0 }),
          f('name', 'text', { required: true }),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Grid',
        fields: [
          f('width', 'number', { min: 1 }),
          f('height', 'number', { min: 1 }),
          f('spawn_x', 'number', { min: 0 }),
          f('spawn_y', 'number', { min: 0 }),
          f('terrain', 'text', { help: 'Legacy column, not read in entities mode' }),
          f('floor_legend', 'map', {
            span: 2,
            mapKeyLabel: 'char',
            mapValue: 'text',
            placeholder: '~',
            help: 'Per-room symbol overrides: char -> terrain symbol',
          }),
        ],
      },
      {
        title: 'Content',
        fields: [
          f('layout', 'json', { span: 2 }),
          f('exits', 'json', { span: 2 }),
          f('spawns', 'json', { span: 2 }),
          f('scripts', 'json', { span: 2 }),
          f('rules', 'json', { span: 2 }),
          f('meta', 'json', { span: 2 }),
        ],
      },
    ],
  },
  region: {
    type: 'region',
    label: 'Regions',
    singular: 'Region',
    idLabel: 'region_id',
    idPlaceholder: 'floor1',
    editorNote: 'Regions use the dedicated region editor with floor palette and zones.',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('theme', 'text', { help: NOT_READ }),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Floors',
        fields: [
          f('floor_tribe', 'text', { placeholder: 'orcs' }),
          f('biome_theme', 'text', { placeholder: 'cave' }),
          f('floor_index', 'number', { min: 1, max: 7 }),
          f('floor_meta', 'number', { min: 0, max: 9 }),
          f('floor_settings', 'json', { span: 2, help: 'Only floor_settings.overrides.<type>[].id is read' }),
        ],
      },
      {
        title: 'Palette',
        fields: [
          f('floor_palette', 'json', {
            span: 2,
            help: 'Per-region terrain tiles overriding the global terrain palette',
          }),
        ],
      },
    ],
  },
  zone: {
    type: 'zone',
    label: 'Zones',
    singular: 'Zone',
    idLabel: 'region::zone',
    idPlaceholder: 'floor1::1',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('region_id', 'ref', { refType: 'region', required: true }),
          f('zone_id', 'number', { required: true, min: 0 }),
          f('name', 'text'),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Scripting',
        fields: [
          f('zone_script_ref', 'script', {
            scriptKind: 'region',
            help: 'Non-empty marks the zone procedural (Lua generator)',
          }),
          f('rules', 'json', { span: 2, help: 'pvp, magic, recall, respawn, ambient, instance_scope' }),
        ],
      },
      {
        title: 'Flags',
        fields: [f('is_active', 'bool', { help: NOT_READ })],
      },
    ],
  },
  terrain: {
    type: 'terrain',
    label: 'Terrain',
    singular: 'Terrain tile',
    idLabel: 'symbol',
    idPlaceholder: '~',
    listMode: 'palette',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('symbol', 'text', { required: true, placeholder: '~', help: 'Single layout character' }),
          f('name', 'text', { required: true }),
          f('description', 'textarea', { span: 2, help: 'Shown when examining the tile' }),
        ],
      },
      {
        title: 'Display',
        fields: [
          f('color', 'color', { label: 'Foreground' }),
          f('bg_color', 'bgcolor', { label: 'Background' }),
        ],
      },
      {
        title: 'Behaviour',
        fields: [
          f('blocks_move', 'bool'),
          f('blocks_sight', 'bool'),
          f('move_cost', 'number', { min: 1, step: 1, help: '1 = normal; each point above 1 costs extra stamina per step' }),
        ],
      },
    ],
  },
  dialogue: {
    type: 'dialogue',
    label: 'Dialogue',
    singular: 'Dialogue node',
    idLabel: 'node_id',
    idPlaceholder: 'blacksmith_root',
    editorNote: 'Dialogue nodes use the dedicated dialogue editor (node vs voice set).',
    sections: [
      {
        title: 'Node',
        fields: [
          f('text', 'textarea', { span: 2 }),
          f('options', 'array', {
            span: 2,
            addLabel: '+ Add option',
            columns: [
              { key: 'text', widget: 'text', placeholder: 'Continue...' },
              { key: 'targetNode', widget: 'text', placeholder: 'EXIT' },
              { key: 'luaCallback', widget: 'text' },
            ],
          }),
        ],
      },
      {
        title: 'Voice set',
        fields: [
          f('idle', 'array', { span: 2, addLabel: '+ Add line' }),
          f('combat', 'array', { span: 2, addLabel: '+ Add line' }),
          f('death', 'array', { span: 2, addLabel: '+ Add line' }),
        ],
      },
    ],
  },
  skill: {
    type: 'skill',
    label: 'Skills',
    singular: 'Skill',
    idLabel: 'skill_id',
    idPlaceholder: 'fireball',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('category_id', 'ref', { refType: 'skill_category', label: 'Category' }),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Mechanics',
        fields: [
          f('type', 'text', { placeholder: 'combat' }),
          f('activation', 'text', { placeholder: 'weapon' }),
          f('command', 'text', { help: 'Defaults to the skill id' }),
          f('targeting', 'text', { placeholder: 'enemy' }),
          f('range', 'number', { min: 1 }),
          f('cooldown', 'number', { min: 0, step: 0.1 }),
          f('windup', 'number', { min: 0, step: 0.1 }),
        ],
      },
      {
        title: 'Costs',
        fields: [
          f('costs', 'group', {
            fields: [
              f('stamina', 'number', { min: 0 }),
              f('mana', 'number', { min: 0 }),
              f('health', 'number', { min: 0 }),
            ],
          }),
        ],
      },
      {
        title: 'Scripting',
        fields: [f('script', 'script', { scriptKind: 'skills' })],
      },
      {
        title: 'Advancement',
        fields: [
          f('xp_curve', 'text', { help: NOT_READ }),
          f('xp_curve_params', 'json', { help: NOT_READ }),
        ],
      },
    ],
  },
  skill_category: {
    type: 'skill_category',
    label: 'Skill categories',
    singular: 'Skill category',
    idLabel: 'category_id',
    idPlaceholder: 'combat',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Stats',
        fields: [
          f('stats', 'array', { span: 2, addLabel: '+ Add stat' }),
          f('synergyBonus', 'number', { label: 'Synergy bonus', step: 0.05 }),
        ],
      },
    ],
  },
  loot_table: {
    type: 'loot_table',
    label: 'Loot tables',
    singular: 'Loot table',
    idLabel: 'table_id',
    idPlaceholder: 'goblin_common',
    sections: [
      {
        title: 'Identity',
        fields: [f('name', 'text', { help: NOT_READ })],
      },
      {
        title: 'Entries',
        fields: [
          f('entries', 'array', {
            span: 2,
            addLabel: '+ Add entry',
            columns: [
              { key: 'id', widget: 'wiki', placeholder: 'item template id' },
              { key: 'weight', widget: 'number', min: 1 },
            ],
          }),
        ],
      },
    ],
  },
  recipe: {
    type: 'recipe',
    label: 'Recipes',
    singular: 'Recipe',
    idLabel: 'recipe_id',
    idPlaceholder: 'healing_potion',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('skill_id', 'ref', { refType: 'skill', label: 'Skill' }),
          f('required_skill_level', 'number', { min: 0 }),
          f('station_type', 'text', { placeholder: 'alchemy' }),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Crafting',
        fields: [
          f('craft_time_seconds', 'number', { min: 0, step: 0.5 }),
          f('experience_gain', 'number', { min: 0 }),
          f('is_auto_learned', 'bool'),
        ],
      },
      {
        title: 'Inputs',
        fields: [
          f('inputs', 'array', {
            span: 2,
            addLabel: '+ Add input',
            columns: [
              { key: 'template_id', widget: 'wiki', placeholder: 'item template id' },
              { key: 'quantity', widget: 'number', min: 1 },
            ],
          }),
        ],
      },
      {
        title: 'Outputs',
        fields: [
          f('outputs', 'array', {
            span: 2,
            addLabel: '+ Add output',
            columns: [
              { key: 'template_id', widget: 'wiki', placeholder: 'item template id' },
              { key: 'quantity', widget: 'number', min: 1 },
            ],
          }),
        ],
      },
      {
        title: 'Scripting',
        fields: [f('script', 'script', { scriptKind: 'items', help: NOT_READ })],
      },
    ],
  },
  quest: {
    type: 'quest',
    label: 'Quests',
    singular: 'Quest',
    idLabel: 'quest_id',
    idPlaceholder: 'newbie_move',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Scripting',
        fields: [
          f('script', 'script', { scriptKind: 'quest', help: 'Quest logic runs in Lua' }),
        ],
      },
      {
        title: 'Objectives',
        fields: [
          f('objectives', 'array', {
            span: 2,
            addLabel: '+ Add objective',
            columns: [
              { key: 'kind', widget: 'text', placeholder: 'kill' },
              { key: 'target', widget: 'text', placeholder: 'goblin' },
              { key: 'count', widget: 'number', min: 1 },
            ],
          }),
        ],
      },
      {
        title: 'Rewards',
        fields: [
          f('rewards', 'array', {
            span: 2,
            addLabel: '+ Add reward',
            columns: [
              { key: 'kind', widget: 'text', placeholder: 'item' },
              { key: 'payload', widget: 'text' },
            ],
          }),
        ],
      },
    ],
  },
  faction: {
    type: 'faction',
    label: 'Factions',
    singular: 'Faction',
    idLabel: 'faction_id',
    idPlaceholder: 'town_guard',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('ideology', 'text'),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Relations',
        fields: [
          f('relations', 'map', {
            span: 2,
            mapKeyLabel: 'faction',
            mapKeyRefType: 'faction',
            mapValue: 'number',
            help: 'Standing towards another faction',
          }),
        ],
      },
    ],
  },
  class: {
    type: 'class',
    label: 'Classes',
    singular: 'Class',
    idLabel: 'class_id',
    idPlaceholder: 'warrior',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('primary_stat', 'text', { placeholder: 'strength' }),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Progression',
        fields: [
          f('hp_per_level', 'number', { min: 0 }),
          f('mp_per_level', 'number', { min: 0 }),
        ],
      },
    ],
  },
  race: {
    type: 'race',
    label: 'Races',
    singular: 'Race',
    idLabel: 'race_id',
    idPlaceholder: 'human',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Bonuses',
        fields: [
          f('str_bonus', 'number', { label: 'STR bonus' }),
          f('dex_bonus', 'number', { label: 'DEX bonus' }),
          f('int_bonus', 'number', { label: 'INT bonus' }),
          f('con_bonus', 'number', { label: 'CON bonus' }),
          f('wis_bonus', 'number', { label: 'WIS bonus' }),
          f('cha_bonus', 'number', { label: 'CHA bonus' }),
        ],
      },
    ],
  },
  shop: {
    type: 'shop',
    label: 'Shops',
    singular: 'Shop',
    idLabel: 'keeper_id',
    idPlaceholder: 'blacksmith_shop',
    sections: [
      {
        title: 'Keeper',
        fields: [
          f('mob_id', 'ref', { refType: 'mob', label: 'Shopkeeper mob' }),
          f('shop_type', 'text', { placeholder: 'general' }),
        ],
      },
      {
        title: 'Pricing & hours',
        fields: [
          f('markup', 'number', { step: 0.05, min: 0 }),
          f('markdown', 'number', { step: 0.05, min: 0 }),
          f('open_hour', 'number', { min: 0, max: 24 }),
          f('close_hour', 'number', { min: 0, max: 24 }),
        ],
      },
      {
        title: 'Inventory',
        fields: [
          f('inventory', 'map', {
            span: 2,
            mapKeyLabel: 'item',
            mapKeyRefType: 'item',
            mapValue: 'fields',
            mapValueFields: [
              { key: 'max_stock', widget: 'number', min: -1 },
              { key: 'restock_seconds', widget: 'number', min: 0 },
              { key: 'price_override', widget: 'number', min: -1 },
            ],
          }),
        ],
      },
    ],
  },
  board: {
    type: 'board',
    label: 'Boards',
    singular: 'Board',
    idLabel: 'board_id',
    idPlaceholder: 'town_square',
    sections: [
      {
        title: 'Identity',
        fields: [
          f('name', 'text', { required: true }),
          f('region_id', 'ref', { refType: 'region' }),
          f('description', 'textarea', { span: 2 }),
        ],
      },
      {
        title: 'Settings',
        fields: [
          f('max_posts', 'number', { min: 0 }),
          f('read_perm', 'number', { min: 0 }),
          f('write_perm', 'number', { min: 0 }),
        ],
      },
    ],
  },
}

export const ENTITY_TYPES = Object.keys(ENTITY_SCHEMAS)

export function isEntityType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENTITY_SCHEMAS, type)
}

export function schemaFields(schema: EntitySchema): EntityFieldSpec[] {
  return schema.sections.flatMap((s) => s.fields)
}

export function findField(schema: EntitySchema, key: string): EntityFieldSpec | undefined {
  return schemaFields(schema).find((field) => field.key === key)
}
