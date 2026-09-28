import { getPool } from '../../utils/db'

interface SearchResult {
  type: string
  id: string
  name: string
  href: string
}

const VALID_TYPES = new Set(['mob', 'npc', 'item', 'quest', 'region', 'skill', 'recipe', 'room', 'interactable'])

function buildHref(type: string, id: string): string {
  switch (type) {
    case 'room':
      return `/admin/world_rooms/${encodeURIComponent(id)}`
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

  if (type === 'mob' || !type) {
    const rows = await allRows<{ template_id: string; name: string }>(
      `select template_id, name from world.world_mobs`,
      [],
    )
    add(rows, 'mob', (r) => ({ id: r.template_id, name: `${r.template_id} — ${r.name}` }))
    if (type === 'mob') return results.slice(0, limit)
  }

  if (type === 'npc') {
    const rows = await allRows<{ template_id: string; name: string }>(
      `select template_id, name from world.world_mobs where ai = 'passive'`,
      [],
    )
    add(rows, 'npc', (r) => ({ id: r.template_id, name: `${r.template_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'item' || !type) {
    const rows = await allRows<{ template_id: string; name: string }>(
      `select template_id, name from world.world_items`,
      [],
    )
    add(rows, 'item', (r) => ({ id: r.template_id, name: `${r.template_id} — ${r.name}` }))
    if (type === 'item') return results.slice(0, limit)
  }

  if (type === 'quest' || !type) {
    const rows = await allRows<{ quest_id: string; name: string }>(
      `select quest_id, name from world.world_quests`,
      [],
    )
    add(rows, 'quest', (r) => ({ id: r.quest_id, name: `${r.quest_id} — ${r.name}` }))
    if (type === 'quest') return results.slice(0, limit)
  }

  if (type === 'region') {
    const rows = await allRows<{ id: string; name: string }>(
      `select id, name from world.world_regions`,
      [],
    )
    add(rows, 'region', (r) => ({ id: r.id, name: `${r.id} (${r.name})` }))
    return results.slice(0, limit)
  }

  if (type === 'skill') {
    const rows = await allRows<{ skill_id: string; name: string }>(
      `select skill_id, name from world.world_skills`,
      [],
    )
    add(rows, 'skill', (r) => ({ id: r.skill_id, name: `${r.skill_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'recipe') {
    const rows = await allRows<{ recipe_id: string; name: string }>(
      `select recipe_id, name from world.world_recipes`,
      [],
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
    const rows = await allRows<{ template_id: string; name: string }>(
      `select template_id, name from world.world_interactables`,
      [],
    )
    add(rows, 'interactable', (r) => ({ id: r.template_id, name: `${r.template_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (!type) {
    const regions = await allRows<{ id: string; name: string }>(
      `select id, name from world.world_regions`, [])
    add(regions, 'region', (x) => ({ id: x.id, name: `${x.id} (${x.name})` }))
    const skills = await allRows<{ skill_id: string; name: string }>(
      `select skill_id, name from world.world_skills`, [])
    add(skills, 'skill', (x) => ({ id: x.skill_id, name: `${x.skill_id} — ${x.name}` }))
    const recipes = await allRows<{ recipe_id: string; name: string }>(
      `select recipe_id, name from world.world_recipes`, [])
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