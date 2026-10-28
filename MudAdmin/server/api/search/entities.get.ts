import { getPool } from '../../utils/db'
import type { Pool } from 'pg'

interface SearchResult {
  type: string
  id: string
  name: string
  href: string
}

const VALID_TYPES = new Set([
  'mob', 'npc', 'item', 'quest', 'region', 'skill', 'recipe', 'room',
  'interactable', 'zone', 'loot_table', 'terrain', 'dialogue', 'faction',
  'class', 'race', 'shop', 'board', 'skill_category',
])

const WILDCARD_TYPES = ['mob', 'item', 'quest', 'region', 'skill', 'recipe', 'room', 'zone', 'loot_table']

function buildHref(type: string, id: string): string {
  const routeType = type === 'npc' ? 'mob' : type
  return `/entities/${routeType}/${encodeURIComponent(id)}`
}

function matches(q: string, ...fields: unknown[]): boolean {
  if (!q) return true
  const ql = q.toLowerCase()
  return fields.some((f) => f != null && String(f).toLowerCase().includes(ql))
}

interface EntityRow {
  entity_id: string
  name: string | null
  room_id: string | null
  zone_id: string | null
  region_id: string | null
}

function displayName(type: string, r: EntityRow): string {
  switch (type) {
    case 'room':
      return `#${r.room_id ?? r.entity_id.split('::')[1] ?? ''} ${r.name ?? ''}`
    case 'zone':
      return `${r.name ?? r.entity_id} (zone ${r.zone_id ?? ''} in ${r.region_id ?? r.entity_id.split('::')[0]})`
    case 'region':
      return `${r.entity_id} (${r.name ?? ''})`
    default:
      return `${r.entity_id} — ${r.name ?? ''}`
  }
}

async function searchType(pool: Pool, type: string, q: string, limit: number): Promise<SearchResult[]> {
  const entityType = type === 'npc' ? 'mob' : type
  const npcFilter = type === 'npc' ? ` and doc->>'ai' = 'passive'` : ''
  const res = await pool.query<EntityRow>(
    `select entity_id,
            doc->>'name' as name,
            doc->>'room_id' as room_id,
            doc->>'zone_id' as zone_id,
            doc->>'region_id' as region_id
       from world.entities
      where entity_type = $1${npcFilter}`,
    [entityType],
  )
  const out: SearchResult[] = []
  for (const r of res.rows) {
    if (!matches(q, r.entity_id, r.name)) continue
    out.push({ type, id: r.entity_id, name: displayName(type, r), href: buildHref(type, r.entity_id) })
    if (out.length >= limit) break
  }
  return out
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const rawType = String(query.type ?? '').trim().toLowerCase()
  const type = VALID_TYPES.has(rawType) ? rawType : null
  const limit = Math.min(Number(query.limit ?? 25) || 25, 100)

  const pool = getPool()
  const types = type ? [type] : WILDCARD_TYPES
  const results: SearchResult[] = []
  for (const t of types) {
    results.push(...await searchType(pool, t, q, limit))
  }

  const ranked = results.slice(0, limit).sort((a, b) => {
    if (!q) return a.name.localeCompare(b.name)
    const ql = q.toLowerCase()
    const aStarts = a.name.toLowerCase().startsWith(ql)
    const bStarts = b.name.toLowerCase().startsWith(ql)
    if (aStarts !== bStarts) return aStarts ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return { results: ranked, q, type }
})
