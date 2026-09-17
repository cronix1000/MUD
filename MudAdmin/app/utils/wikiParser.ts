export type EntityType = 'room' | 'npc' | 'mob' | 'item' | 'quest' | 'region' | 'skill' | 'recipe' | 'interactable'

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
  switch (type) {
    case 'room': {
      const parts = id.split('::')
      const roomId = parts.pop() ?? ''
      const region = parts.join('::')
      return `/admin/world_rooms/${encodeURIComponent(region + '::' + roomId)}`
    }
    case 'region':
      return `/admin/world/regions/${encodeURIComponent(id)}`
    case 'mob':
    case 'npc':
      return `/admin/world_mobs/${encodeURIComponent(id)}`
    case 'item':
      return `/admin/world_items/${encodeURIComponent(id)}`
    case 'quest':
      return `/admin/world/quests/${encodeURIComponent(id)}`
    case 'skill':
      return `/admin/world_skills/${encodeURIComponent(id)}`
    case 'recipe':
      return `/admin/recipes/${encodeURIComponent(id)}`
    case 'interactable':
      return `/admin/world_interactables/${encodeURIComponent(id)}`
    default:
      return '#'
  }
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
}

export const knownTypes: EntityType[] = ['room', 'npc', 'mob', 'item', 'quest', 'region', 'skill', 'recipe', 'interactable']

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
}
