export type EntityType = 'room' | 'npc' | 'mob' | 'item' | 'quest' | 'region' | 'skill' | 'skill_category' | 'recipe' | 'interactable' | 'zone' | 'loot_table' | 'terrain' | 'dialogue' | 'faction' | 'class' | 'race' | 'shop' | 'board'

export interface WikiToken {
  type: 'text' | 'link'
  text: string
  entityType?: EntityType
  entityId?: string
  start: number
  end: number
}

const WIKI_LINK = /\[\[([a-z]+):([^\]]+)\]\]/g

export function parseWiki(text: string): WikiToken[] {
  const tokens: WikiToken[] = []
  let lastEnd = 0
  let match: RegExpExecArray | null
  WIKI_LINK.lastIndex = 0
  while ((match = WIKI_LINK.exec(text)) !== null) {
    if (match.index > lastEnd) {
      tokens.push({ type: 'text', text: text.slice(lastEnd, match.index), start: lastEnd, end: match.index })
    }
    tokens.push({
      type: 'link',
      text: match[0],
      entityType: match[1] as EntityType,
      entityId: match[2],
      start: match.index,
      end: match.index + match[0].length,
    })
    lastEnd = match.index + match[0].length
  }
  if (lastEnd < text.length) {
    tokens.push({ type: 'text', text: text.slice(lastEnd), start: lastEnd, end: text.length })
  }
  return tokens
}

export function entityHref(type: EntityType, id: string): string {
  const routeType = type === 'npc' ? 'mob' : type
  return `/entities/${routeType}/${encodeURIComponent(id)}`
}

export const ENTITY_COLORS: Record<EntityType, string> = {
  room: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50',
  npc: 'bg-cyan-900/40 text-cyan-200 border-cyan-700/50',
  mob: 'bg-red-900/40 text-red-200 border-red-700/50',
  item: 'bg-yellow-900/40 text-yellow-200 border-yellow-700/50',
  quest: 'bg-amber-900/40 text-amber-200 border-amber-700/50',
  region: 'bg-sky-900/40 text-sky-200 border-sky-700/50',
  skill: 'bg-purple-900/40 text-purple-200 border-purple-700/50',
  recipe: 'bg-teal-900/40 text-teal-200 border-teal-700/50',
  interactable: 'bg-pink-900/40 text-pink-200 border-pink-700/50',
  zone: 'bg-indigo-900/40 text-indigo-200 border-indigo-700/50',
  loot_table: 'bg-orange-900/40 text-orange-200 border-orange-700/50',
  skill_category: 'bg-violet-900/40 text-violet-200 border-violet-700/50',
  terrain: 'bg-lime-900/40 text-lime-200 border-lime-700/50',
  dialogue: 'bg-fuchsia-900/40 text-fuchsia-200 border-fuchsia-700/50',
  faction: 'bg-rose-900/40 text-rose-200 border-rose-700/50',
  class: 'bg-blue-900/40 text-blue-200 border-blue-700/50',
  race: 'bg-cyan-900/40 text-cyan-200 border-cyan-700/50',
  shop: 'bg-stone-900/40 text-stone-200 border-stone-700/50',
  board: 'bg-neutral-900/40 text-neutral-200 border-neutral-700/50',
}

export const knownTypes: EntityType[] = ['room', 'npc', 'mob', 'item', 'quest', 'region', 'skill', 'skill_category', 'recipe', 'interactable', 'zone', 'loot_table', 'terrain', 'dialogue', 'faction', 'class', 'race', 'shop', 'board']

export const ENTITY_ICONS: Record<EntityType, string> = {
  room: '#',
  npc: '@',
  mob: '!',
  item: '·',
  quest: '?',
  region: '~',
  skill: '*',
  recipe: '+',
  interactable: '^',
  zone: '§',
  loot_table: '%',
  skill_category: '*',
  terrain: '~',
  dialogue: '"',
  faction: 'F',
  class: 'C',
  race: 'R',
  shop: '$',
  board: 'B',
}
