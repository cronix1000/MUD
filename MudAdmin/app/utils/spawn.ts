export type SpawnType = 'mob' | 'npc' | 'item' | 'interactable'

const SPAWN_COLORS: Record<SpawnType, string> = {
  mob: '#ef4444',
  npc: '#06b6d4',
  item: '#eab308',
  interactable: '#a855f7',
}

export function spawnColor(type: string): string {
  return SPAWN_COLORS[type as SpawnType] ?? '#a3a3a3'
}

export function spawnInitial(type: string): string {
  return type ? type[0]?.toUpperCase() ?? '?' : '?'
}
