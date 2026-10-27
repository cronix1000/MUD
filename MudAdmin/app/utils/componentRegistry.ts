// componentRegistry.ts — typed shape for `components_json` columns.
//
// Mirrors the per-entity component definitions the C++ server reads at boot.
// For items, see:
//   ModularMudServer/ItemFactory.cpp:55-104 (LoadSingleItemFromJSON)
//   ModularMudServer/WeaponComponent.h
//   ModularMudServer/ArmourComponent.h
//   ModularMudServer/ItemComponent.h (allowedSlots only)
//
// Same hand-maintained pattern as `app/utils/metaKeys.ts`. When a C++
// component gains a field, mirror it here.
//
// Per-archetype tables (`item`, `mob`, `room`, `interactable`) describe
// what keys may appear under the entity's `components_json` envelope and
// how to render each one. Only `item` is populated this PR; other
// archetypes ship as empty objects ready for follow-up entries.

import type { MetaKeySpec } from '~/utils/metaKeys'

export type ComponentArchetype = 'item' | 'mob' | 'room' | 'interactable'

export interface ComponentFieldSpec extends MetaKeySpec {
  key: string
}

export interface ComponentPreset {
  id: string
  label: string
  values: Record<string, unknown>
}

export type ComponentShape = 'scalar' | 'array<string>'

export interface ComponentSpec {
  key: string
  label: string
  shape: ComponentShape
  appliesWhen?: (row: Record<string, unknown>) => boolean
  fields?: ComponentFieldSpec[]
  itemValues?: string[]
  itemMaxLen?: number
  default?: string[]
  help?: string
}

export const EQUIPMENT_SLOTS: string[] = [
  'helmet',
  'chest',
  'bracers',
  'leggings',
  'mainArm',
  'offHand',
  'shoulders',
  'knees',
  'shoes',
  'necklace',
  'back',
  'waist',
  'wrists',
  'finger1',
  'finger2',
  'finger3',
  'finger4',
  'finger5',
  'finger6',
  'finger7',
  'finger8',
  'finger9',
  'finger10',
]

const WEAPON_FIELDS: ComponentFieldSpec[] = [
  { key: 'minDamage', type: 'int', default: 1, min: 0, max: 1000, label: 'Min damage' },
  { key: 'maxDamage', type: 'int', default: 2, min: 0, max: 1000, label: 'Max damage' },
  {
    key: 'damageType',
    type: 'enum',
    default: 'blunt',
    values: ['blunt', 'slash', 'chop', 'poke'],
    label: 'Damage type',
  },
  { key: 'defaultSkill', type: 'string', default: '', maxLen: 80, label: 'Default skill template' },
  { key: 'strScaling', type: 'float', default: 0, min: 0, max: 5, label: 'STR scaling' },
  { key: 'dexScaling', type: 'float', default: 0, min: 0, max: 5, label: 'DEX scaling' },
  { key: 'intScaling', type: 'float', default: 0, min: 0, max: 5, label: 'INT scaling' },
  {
    key: 'alignmentType',
    type: 'enum',
    default: 'none',
    values: ['none', 'chaos', 'fae'],
    label: 'Alignment type',
  },
  { key: 'alignmentScaling', type: 'float', default: 0, min: 0, max: 5, label: 'Alignment scaling' },
  { key: 'maxRange', type: 'int', default: 1, min: 1, max: 50, label: 'Max range' },
  { key: 'baseWindup', type: 'float', default: 1, min: 0, max: 10, label: 'Base windup (s)' },
  {
    key: 'scalingStat',
    type: 'enum',
    default: 'strength',
    values: ['strength', 'dexterity', 'intelligence'],
    label: 'Scaling stat',
  },
  { key: 'scalingFactor', type: 'float', default: 0.02, min: 0, max: 1, label: 'Scaling factor' },
  { key: 'twoHanded', type: 'bool', default: false, label: 'Two-handed' },
]

const ARMOUR_FIELDS: ComponentFieldSpec[] = [
  { key: 'defense', type: 'int', default: 0, min: 0, max: 1000, label: 'Defense' },
  { key: 'magicDefense', type: 'int', default: 0, min: -100, max: 1000, label: 'Magic defense' },
  {
    key: 'type',
    type: 'enum',
    default: 'cloth',
    values: ['cloth', 'leather', 'mail', 'plate'],
    label: 'Armour type',
  },
]

const SCRIPT_FIELDS: ComponentFieldSpec[] = [
  { key: 'on_hit_proc', type: 'string', default: '', maxLen: 200, label: 'on_hit_proc path' },
]

const ITEM_COMPONENTS: ComponentSpec[] = [
  {
    key: 'weapon',
    label: 'Weapon',
    shape: 'scalar',
    fields: WEAPON_FIELDS,
    help: 'Mirrors ModularMudServer/WeaponComponent.h — presence of components.weapon makes the C++ server treat this as a weapon (ItemFactory.cpp:59-67).',
  },
  {
    key: 'armour',
    label: 'Armour',
    shape: 'scalar',
    fields: ARMOUR_FIELDS,
    help: 'Mirrors ModularMudServer/ArmourComponent.h — presence of components.armour makes the C++ server treat this as armour (ItemFactory.cpp:69-73).',
  },
  {
    key: 'scripts',
    label: 'Scripts',
    shape: 'scalar',
    fields: SCRIPT_FIELDS,
    help: 'Per-event Lua hooks. Mirrors ItemFactory.cpp:74-77 (on_hit_proc).',
  },
  {
    key: 'allowed_slots',
    label: 'Allowed slots',
    shape: 'array<string>',
    default: [],
    itemMaxLen: 30,
    itemValues: EQUIPMENT_SLOTS,
    help: 'Equipment slots this item may occupy. Mirrors ItemComponent::allowedSlots.',
  },
  {
    key: 'passive_skills',
    label: 'Passive skills',
    shape: 'array<string>',
    default: [],
    itemMaxLen: 80,
    help: 'Mirrors ItemFactory.cpp:98-104 — skill templates granted passively while held.',
  },
  {
    key: 'meta',
    label: 'Meta',
    shape: 'scalar',
    fields: [],
    help: 'Special — renders AdminMetaEditor for this entity archetype.',
  },
]

const PORTAL_FIELDS: ComponentFieldSpec[] = [
  { key: 'destination_room', type: 'int', default: -1, min: -1, max: 2147483647, label: 'Destination room id' },
  { key: 'direction_command', type: 'string', default: 'enter', maxLen: 40, label: 'Direction command' },
  { key: 'is_open', type: 'bool', default: true, label: 'Is open' },
  { key: 'is_locked', type: 'bool', default: false, label: 'Is locked' },
  { key: 'key_id', type: 'int', default: -1, min: -1, max: 2147483647, label: 'Key id' },
  { key: 'max_uses', type: 'int', default: -1, min: -1, max: 2147483647, label: 'Max uses (-1 = ∞)' },
]

const CHEST_FIELDS: ComponentFieldSpec[] = [
  { key: 'is_open', type: 'bool', default: false, label: 'Is open' },
  { key: 'is_locked', type: 'bool', default: false, label: 'Is locked' },
  { key: 'key_id', type: 'int', default: -1, min: -1, max: 2147483647, label: 'Key id' },
  { key: 'loot_table', type: 'string', default: '', maxLen: 80, label: 'Loot table template id' },
  { key: 'max_uses', type: 'int', default: 1, min: 0, max: 2147483647, label: 'Max uses' },
]

const DOOR_FIELDS: ComponentFieldSpec[] = [
  { key: 'is_open', type: 'bool', default: false, label: 'Is open' },
  { key: 'is_locked', type: 'bool', default: true, label: 'Is locked' },
  { key: 'key_id', type: 'string', default: '', maxLen: 80, label: 'Key id (template)' },
  { key: 'destination_room', type: 'int', default: -1, min: -1, max: 2147483647, label: 'Destination room id' },
  { key: 'destination_x', type: 'int', default: -1, min: -1, max: 32767, label: 'Destination x' },
  { key: 'destination_y', type: 'int', default: -1, min: -1, max: 32767, label: 'Destination y' },
  { key: 'open_message', type: 'string', default: 'The door creaks open.', maxLen: 200, label: 'Open message' },
  { key: 'close_message', type: 'string', default: 'The door slams shut.', maxLen: 200, label: 'Close message' },
]

const LEVER_FIELDS: ComponentFieldSpec[] = [
  { key: 'state', type: 'enum', default: 'up', values: ['up', 'down'], label: 'State' },
  { key: 'event_trigger', type: 'string', default: '', maxLen: 120, label: 'Event trigger' },
  { key: 'target_room', type: 'int', default: -1, min: -1, max: 2147483647, label: 'Target room id' },
  { key: 'cooldown', type: 'int', default: 0, min: 0, max: 86400, label: 'Cooldown (s)' },
  { key: 'can_be_reset', type: 'bool', default: true, label: 'Can be reset' },
  { key: 'uses_remaining', type: 'int', default: -1, min: -1, max: 2147483647, label: 'Uses remaining (-1 = ∞)' },
]

const HEALING_FIELDS: ComponentFieldSpec[] = [
  { key: 'heal_amount', type: 'int', default: 25, min: 0, max: 1000000, label: 'Heal amount (HP)' },
  { key: 'mana_amount', type: 'int', default: 0, min: 0, max: 1000000, label: 'Mana amount' },
  { key: 'cooldown', type: 'int', default: 300, min: 0, max: 86400, label: 'Cooldown (s)' },
  { key: 'max_uses_per_player', type: 'int', default: -1, min: -1, max: 1000000, label: 'Max uses per player' },
  { key: 'blessing_type', type: 'enum', default: 'health', values: ['health', 'mana', 'both'], label: 'Blessing type' },
  { key: 'prayer_message', type: 'string', default: 'You feel blessed by divine energy.', maxLen: 200, label: 'Prayer message' },
]

const INVENTORY_FIELDS: ComponentFieldSpec[] = [
  { key: 'cooldown', type: 'int', default: 0, min: 0, max: 86400, label: 'Cooldown (s)' },
  { key: 'max_uses', type: 'int', default: -1, min: -1, max: 2147483647, label: 'Max uses (-1 = ∞)' },
]

const CRAFTING_FIELDS: ComponentFieldSpec[] = [
  { key: 'cooldown', type: 'int', default: 0, min: 0, max: 86400, label: 'Cooldown (s)' },
  { key: 'max_uses', type: 'int', default: -1, min: -1, max: 2147483647, label: 'Max uses (-1 = ∞)' },
]

const LOOT_FIELDS: ComponentFieldSpec[] = [
  { key: 'table', type: 'string', default: '', maxLen: 80, label: 'Loot table template id' },
  { key: 'max_uses', type: 'int', default: 1, min: 0, max: 2147483647, label: 'Max uses' },
]

export const INTERACTABLE_OVERRIDE_ACTIONS: string[] = [
  'look',
  'inspect',
  'use',
  'equip',
  'unequip',
  'drop',
]

const INTERACTABLE_COMPONENTS: ComponentSpec[] = [
  {
    key: 'portal',
    label: 'Portal',
    shape: 'scalar',
    fields: PORTAL_FIELDS,
    help: 'Mirrors ModularMudServer/InteractableFactory.cpp:115-128 — destination_room / direction_command / is_open / is_locked / key_id / max_uses.',
  },
  {
    key: 'chest',
    label: 'Chest',
    shape: 'scalar',
    fields: CHEST_FIELDS,
    help: 'Mirrors ModularMudServer/InteractableFactory.cpp:130-143 — is_open / is_locked / key_id / loot_table / max_uses.',
  },
  {
    key: 'door',
    label: 'Door',
    shape: 'scalar',
    fields: DOOR_FIELDS,
    help: 'Mirrors ModularMudServer/InteractableFactory.cpp:144-158 — open/close messages, destination, key id.',
  },
  {
    key: 'lever',
    label: 'Lever',
    shape: 'scalar',
    fields: LEVER_FIELDS,
    help: 'Mirrors ModularMudServer/InteractableFactory.cpp:159-173 — state / event_trigger / target_room / cooldown / uses_remaining.',
  },
  {
    key: 'healing',
    label: 'Healing shrine',
    shape: 'scalar',
    fields: HEALING_FIELDS,
    help: 'Mirrors ModularMudServer/InteractableFactory.cpp:174-188 — ShrineComponent fields.',
  },
  {
    key: 'inventory',
    label: 'Container',
    shape: 'scalar',
    fields: INVENTORY_FIELDS,
    help: 'Mirrors ModularMudServer/InteractableFactory.cpp:189-195 — generic container with optional cooldown / max_uses.',
  },
  {
    key: 'crafting',
    label: 'crafting station',
    shape: 'scalar',
    fields: CRAFTING_FIELDS,
    help: 'Magic circle / crafting station. Mirrors the crafting branch in InteractableFactory.cpp — optional `cooldown` and `max_uses`. Heat and other qualities are auto-derived from `meta.alchemy_circle_id` (the drawn symbol) at runtime via the C++ alchemy decoder — see `CraftingStationComponent`. Set the symbol on the Meta card; the C++ factory only attaches the marker here.',
  },
  {
    key: 'loot',
    label: 'Loot',
    shape: 'scalar',
    fields: LOOT_FIELDS,
    help: 'Mirrors ModularMudServer/InteractableFactory.cpp:196-202 — loot table reference + max_uses.',
  },
  {
    key: 'overrides',
    label: 'Interaction overrides',
    shape: 'scalar',
    fields: [],
    help: 'Mirrors InteractionOverrideComponent (InteractionOverrideComponent.h:5). Wired on the wire as `components.messages` (InteractableFactory.cpp:95-108 reads it by that key — the struct field is `overrides`, the JSON name is historical). The editor renders this as an action → message pool map; tokens {name}, {slot}, {charges}, {wielder}, {level} are expanded at render time (InteractionMessage.cpp:16).',
  },
  {
    key: 'meta',
    label: 'Meta',
    shape: 'scalar',
    fields: [],
    help: 'Special — renders AdminMetaEditor for this entity archetype.',
  },
]

export const COMPONENT_REGISTRY: Record<ComponentArchetype, ComponentSpec[]> = {
  item: ITEM_COMPONENTS,
  mob: [],
  room: [],
  interactable: INTERACTABLE_COMPONENTS,
}

export const COMPONENT_PRESETS: Record<ComponentArchetype, Record<string, ComponentPreset[]>> = {
  item: {
    weapon: [],
    armour: [],
    scripts: [],
    allowed_slots: [],
    passive_skills: [],
    meta: [],
  },
  interactable: {
    portal: [
      { id: 'one_way', label: 'One-way (no return exit)', values: { destination_room: -1, is_open: true, is_locked: false, direction_command: 'enter' } },
      { id: 'locked', label: 'Locked portal', values: { is_locked: true, key_id: -1 } },
    ],
    chest: [
      { id: 'locked', label: 'Locked chest', values: { is_locked: true, max_uses: 1 } },
      { id: 'unlimited', label: 'Unlimited uses', values: { max_uses: -1 } },
    ],
    door: [
      { id: 'locked', label: 'Locked door', values: { is_locked: true } },
      { id: 'unlocked', label: 'Unlocked door', values: { is_locked: false, is_open: false } },
    ],
    lever: [
      { id: 'toggles_door', label: 'Toggles door in same room', values: { event_trigger: 'toggle_door', can_be_reset: true } },
    ],
    healing: [
      { id: 'small', label: 'Small heal (10 HP)', values: { heal_amount: 10, mana_amount: 0, cooldown: 60, blessing_type: 'health' } },
      { id: 'big', label: 'Big heal (50 HP)', values: { heal_amount: 50, mana_amount: 0, cooldown: 300, blessing_type: 'health' } },
      { id: 'full_restore', label: 'Full HP+MP', values: { heal_amount: 999, mana_amount: 999, cooldown: 600, blessing_type: 'both' } },
    ],
    inventory: [
      { id: 'player_stash', label: 'Player stash (20 slots)', values: { cooldown: 0, max_uses: -1 } },
    ],
    loot: [
      { id: 'default_table', label: 'Default loot table', values: { table: 'default', max_uses: 1 } },
    ],
    overrides: [],
    meta: [],
  },
  mob: {},
  room: {},
}

export function getRegisteredComponentKeys(archetype: ComponentArchetype): string[] {
  return COMPONENT_REGISTRY[archetype].map((c) => c.key)
}

export function getComponentSpec(archetype: ComponentArchetype, key: string): ComponentSpec | null {
  return COMPONENT_REGISTRY[archetype].find((c) => c.key === key) ?? null
}

export function getDefaultForSpec(spec: ComponentSpec): unknown {
  if (spec.shape === 'array<string>') return Array.isArray(spec.default) ? [...spec.default] : []
  if (spec.key === 'meta') return {}
  const out: Record<string, unknown> = {}
  for (const f of spec.fields ?? []) {
    out[f.key] = f.default
  }
  return out
}