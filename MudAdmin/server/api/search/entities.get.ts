import { getPool } from '../../utils/db'

interface SearchResult {
  type: string
  id: string
  name: string
  href: string
}

const VALID_TYPES = new Set(['mob', 'npc', 'item', 'quest', 'region', 'skill', 'recipe', 'room', 'interactable', 'zone', 'loot_table'])

function buildHref(type: string, id: string): string {
  switch (type) {
    case 'room':
      return `/world_rooms/${encodeURIComponent(id)}`
    case 'region':
      return `/world/regions/${encodeURIComponent(id)}`
    case 'mob':
    case 'npc':
      return `/entities/mob/${encodeURIComponent(id)}`
    case 'item':
      return `/entities/item/${encodeURIComponent(id)}`
    case 'quest':
      return `/entities/quest/${encodeURIComponent(id)}`
    case 'skill':
      return `/entities/skill/${encodeURIComponent(id)}`
    case 'recipe':
      return `/entities/recipe/${encodeURIComponent(id)}`
    case 'interactable':
      return `/entities/interactable/${encodeURIComponent(id)}`
    case 'zone':
      return `/entities/zone/${encodeURIComponent(id)}`
    case 'loot_table':
      return `/entities/loot_table/${encodeURIComponent(id)}`
    default:
      return '#'
  }
}

function matches(q: string, ...fields: unknown[]): boolean {
  if (!q) return true
  const ql = q.toLowerCase()
  return fields.some((f) => f != null && String(f).toLowerCase().includes(ql))
}

interface QueryArgs {
  type: string | null
  q: string
  limit: number
}

async function runQuery(args: QueryArgs): Promise<SearchResult[]> {
  const { type, q, limit } = args
  const results: SearchResult[] = []
  const pool = getPool()

  const add = <T extends Record<string, unknown>>(
    rows: T[],
    mapType: string,
    mapFn: (r: T) => { id: string; name: string },
  ) => {
    for (const r of rows) {
      if (!matches(q, ...Object.values(r))) continue
      const mapped = mapFn(r)
      results.push({ type: mapType, ...mapped, href: buildHref(mapType, mapped.id) })
    }
  }

  const allRows = async <T extends Record<string, unknown>>(sql: string, params: unknown[]) =>
    (await pool.query<T>(sql, params)).rows

  // Legacy-table query with a world.entities fallback for deployments where
  // the empty legacy table has been dropped (migration 30).
  const allRowsOr = async <T extends Record<string, unknown>>(
    sql: string,
    entityType: string,
    project: (e: { entity_id: string; doc: Record<string, unknown> }) => T,
  ): Promise<T[]> => {
    try {
      return (await pool.query<T>(sql, [])).rows
    } catch (e) {
      if ((e as { code?: string }).code !== '42P01') throw e
      const r = await pool.query<{ entity_id: string; doc: Record<string, unknown> }>(
        `select entity_id, doc from world.entities where entity_type = $1`,
        [entityType],
      )
      return r.rows.map(project)
    }
  }

  if (type === 'mob' || !type) {
    const r = await pool.query<{ entity_id: string; name: string }>(
      `select entity_id, doc->>'name' as name from world.entities where entity_type = 'mob'`,
      [],
    )
    add(r.rows, 'mob', (x) => ({ id: x.entity_id, name: `${x.entity_id} — ${x.name ?? ''}` }))
    if (type === 'mob') return results.slice(0, limit)
  }

  if (type === 'npc') {
    const r = await pool.query<{ entity_id: string; name: string }>(
      `select entity_id, doc->>'name' as name from world.entities where entity_type = 'mob' and doc->>'ai' = 'passive'`,
      [],
    )
    add(r.rows, 'npc', (x) => ({ id: x.entity_id, name: `${x.entity_id} — ${x.name ?? ''}` }))
    return results.slice(0, limit)
  }

  if (type === 'item' || !type) {
    const r = await pool.query<{ entity_id: string; name: string }>(
      `select entity_id, doc->>'name' as name from world.entities where entity_type = 'item'`,
      [],
    )
    add(r.rows, 'item', (x) => ({ id: x.entity_id, name: `${x.entity_id} — ${x.name ?? ''}` }))
    if (type === 'item') return results.slice(0, limit)
  }

  if (type === 'quest' || !type) {
    const rows = await allRowsOr<{ quest_id: string; name: string }>(
      `select quest_id, name from world.world_quests`,
      'quest',
      (e) => ({ quest_id: e.entity_id, name: String(e.doc.name ?? '') }),
    )
    add(rows, 'quest', (r) => ({ id: r.quest_id, name: `${r.quest_id} — ${r.name}` }))
    if (type === 'quest') return results.slice(0, limit)
  }

  if (type === 'region') {
    const r = await pool.query<{ entity_id: string; name: string }>(
      `select entity_id, doc->>'name' as name from world.entities where entity_type = 'region'`,
      [],
    )
    add(r.rows, 'region', (x) => ({ id: x.entity_id, name: `${x.entity_id} (${x.name ?? ''})` }))
    return results.slice(0, limit)
  }

  if (type === 'skill') {
    const rows = await allRowsOr<{ skill_id: string; name: string }>(
      `select skill_id, name from world.world_skills`,
      'skill',
      (e) => ({ skill_id: e.entity_id, name: String(e.doc.name ?? '') }),
    )
    add(rows, 'skill', (r) => ({ id: r.skill_id, name: `${r.skill_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'recipe') {
    const rows = await allRowsOr<{ recipe_id: string; name: string }>(
      `select recipe_id, name from world.world_recipes`,
      'recipe',
      (e) => ({ recipe_id: e.entity_id, name: String(e.doc.name ?? '') }),
    )
    add(rows, 'recipe', (r) => ({ id: r.recipe_id, name: `${r.recipe_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'room') {
    const rows = await allRows<{ region_id: string; room_id: number; name: string }>(
      `select region_id, room_id, name from world.world_rooms`,
      [],
    )
    add(rows, 'room', (r) => ({
      id: `${r.region_id}::${r.room_id}`,
      name: `#${r.room_id} ${r.name}`,
    }))
    return results.slice(0, limit)
  }

  if (type === 'interactable') {
    const r = await pool.query<{ entity_id: string; name: string }>(
      `select entity_id, doc->>'name' as name from world.entities where entity_type = 'interactable'`,
      [],
    )
    add(r.rows, 'interactable', (x) => ({ id: x.entity_id, name: `${x.entity_id} — ${x.name ?? ''}` }))
    return results.slice(0, limit)
  }

  if (type === 'zone') {
    const rows = await allRowsOr<{ region_id: string; zone_id: number; name: string }>(
      `select region_id, zone_id, name from world.world_zones`,
      'zone',
      (e) => ({
        region_id: String(e.doc.region_id ?? ''),
        zone_id: Number(e.doc.zone_id ?? 0),
        name: String(e.doc.name ?? ''),
      }),
    )
    add(rows, 'zone', (r) => ({
      id: `${r.region_id}::${r.zone_id}`,
      name: `${r.name} (zone ${r.zone_id} in ${r.region_id})`,
    }))
    return results.slice(0, limit)
  }

  if (type === 'loot_table') {
    const r = await pool.query<{ entity_id: string; name: string }>(
      `select entity_id, doc->>'name' as name from world.entities where entity_type = 'loot_table'`,
      [],
    )
    add(r.rows, 'loot_table', (x) => ({ id: x.entity_id, name: `${x.entity_id} — ${x.name ?? ''}` }))
    return results.slice(0, limit)
  }

  if (!type) {
    const regions = await allRows<{ id: string; name: string }>(
      `select id, name from world.world_regions`, [])
    add(regions, 'region', (x) => ({ id: x.id, name: `${x.id} (${x.name})` }))
    const skills = await allRowsOr<{ skill_id: string; name: string }>(
      `select skill_id, name from world.world_skills`,
      'skill',
      (e) => ({ skill_id: e.entity_id, name: String(e.doc.name ?? '') }),
    )
    add(skills, 'skill', (x) => ({ id: x.skill_id, name: `${x.skill_id} — ${x.name}` }))
    const recipes = await allRowsOr<{ recipe_id: string; name: string }>(
      `select recipe_id, name from world.world_recipes`,
      'recipe',
      (e) => ({ recipe_id: e.entity_id, name: String(e.doc.name ?? '') }),
    )
    add(recipes, 'recipe', (x) => ({ id: x.recipe_id, name: `${x.recipe_id} — ${x.name}` }))
  }

  return results.slice(0, limit)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const rawType = String(query.type ?? '').trim().toLowerCase()
  const type = VALID_TYPES.has(rawType) ? rawType : null
  const limit = Math.min(Number(query.limit ?? 25) || 25, 100)

  const results = await runQuery({ type, q, limit })

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