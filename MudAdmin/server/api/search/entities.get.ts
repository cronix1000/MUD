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
  worldId: string
  limit: number
}

async function runQuery(args: QueryArgs): Promise<SearchResult[]> {
  const { type, q, worldId, limit } = args
  const results: SearchResult[] = []
  const pool = getPool()

  const add = <T extends { world_id?: string } & Record<string, unknown>>(
    rows: T[],
    mapType: string,
    mapFn: (r: T) => { id: string; name: string },
  ) => {
    for (const r of rows) {
      if (!matches(q, ...Object.values(r as Record<string, unknown>))) continue
      const mapped = mapFn(r)
      results.push({ type: mapType, ...mapped, href: buildHref(mapType, mapped.id) })
    }
  }

  const allRows = async <T,>(sql: string, params: unknown[]) =>
    (await pool.query<T>(sql, params)).rows

  if (type === 'mob' || (!type && !worldId)) {
    const rows = await allRows<{ world_id: string; template_id: string; name: string }>(
      worldId
        ? `select world_id, template_id, name from world.world_mobs where world_id = $1`
        : `select world_id, template_id, name from world.world_mobs`,
      worldId ? [worldId] : [],
    )
    add(rows, 'mob', (r) => ({ id: `${r.world_id}::${r.template_id}`, name: `${r.template_id} — ${r.name}` }))
    if (type === 'mob') return results.slice(0, limit)
  }

  if (type === 'npc') {
    const rows = await allRows<{ world_id: string; template_id: string; name: string }>(
      worldId
        ? `select world_id, template_id, name from world.world_mobs where world_id = $1 and ai = 'passive'`
        : `select world_id, template_id, name from world.world_mobs where ai = 'passive'`,
      worldId ? [worldId] : [],
    )
    add(rows, 'npc', (r) => ({ id: `${r.world_id}::${r.template_id}`, name: `${r.template_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'item' || (!type && !worldId)) {
    const rows = await allRows<{ world_id: string; template_id: string; name: string }>(
      worldId
        ? `select world_id, template_id, name from world.world_items where world_id = $1`
        : `select world_id, template_id, name from world.world_items`,
      worldId ? [worldId] : [],
    )
    add(rows, 'item', (r) => ({ id: `${r.world_id}::${r.template_id}`, name: `${r.template_id} — ${r.name}` }))
    if (type === 'item') return results.slice(0, limit)
  }

  if (type === 'quest' || (!type && !worldId)) {
    const rows = await allRows<{ world_id: string; quest_id: string; name: string }>(
      worldId
        ? `select world_id, quest_id, name from world.world_quests where world_id = $1`
        : `select world_id, quest_id, name from world.world_quests`,
      worldId ? [worldId] : [],
    )
    add(rows, 'quest', (r) => ({ id: `${r.world_id}::${r.quest_id}`, name: `${r.quest_id} — ${r.name}` }))
    if (type === 'quest') return results.slice(0, limit)
  }

  if (type === 'region') {
    const rows = await allRows<{ world_id: string; id: string; name: string }>(
      worldId
        ? `select world_id, id, name from world.world_regions where world_id = $1`
        : `select world_id, id, name from world.world_regions`,
      worldId ? [worldId] : [],
    )
    add(rows, 'region', (r) => ({ id: `${r.world_id}::${r.id}`, name: `${r.id} (${r.name})` }))
    return results.slice(0, limit)
  }

  if (type === 'skill') {
    const rows = await allRows<{ world_id: string; skill_id: string; name: string }>(
      worldId
        ? `select world_id, skill_id, name from world.world_skills where world_id = $1`
        : `select world_id, skill_id, name from world.world_skills`,
      worldId ? [worldId] : [],
    )
    add(rows, 'skill', (r) => ({ id: `${r.world_id}::${r.skill_id}`, name: `${r.skill_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'recipe') {
    const rows = await allRows<{ world_id: string; recipe_id: string; name: string }>(
      worldId
        ? `select world_id, recipe_id, name from world.world_recipes where world_id = $1`
        : `select world_id, recipe_id, name from world.world_recipes`,
      worldId ? [worldId] : [],
    )
    add(rows, 'recipe', (r) => ({ id: `${r.world_id}::${r.recipe_id}`, name: `${r.recipe_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'room') {
    const rows = await allRows<{ world_id: string; region_id: string; room_id: number; name: string }>(
      worldId
        ? `select world_id, region_id, room_id, name from world.world_rooms where world_id = $1`
        : `select world_id, region_id, room_id, name from world.world_rooms`,
      worldId ? [worldId] : [],
    )
    add(rows, 'room', (r) => ({
      id: `${r.world_id}::${r.region_id}::${r.room_id}`,
      name: `#${r.room_id} ${r.name}`,
    }))
    return results.slice(0, limit)
  }

  if (type === 'interactable') {
    const rows = await allRows<{ world_id: string; template_id: string; name: string }>(
      worldId
        ? `select world_id, template_id, name from world.world_interactables where world_id = $1`
        : `select world_id, template_id, name from world.world_interactables`,
      worldId ? [worldId] : [],
    )
    add(rows, 'interactable', (r) => ({ id: `${r.world_id}::${r.template_id}`, name: `${r.template_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (!worldId || worldId === 'all') {
    const regions = await allRows<{ world_id: string; id: string; name: string }>(
      `select world_id, id, name from world.world_regions`, [])
    add(regions, 'region', (x) => ({ id: `${x.world_id}::${x.id}`, name: `${x.id} (${x.name})` }))
    const skills = await allRows<{ world_id: string; skill_id: string; name: string }>(
      `select world_id, skill_id, name from world.world_skills`, [])
    add(skills, 'skill', (x) => ({ id: `${x.world_id}::${x.skill_id}`, name: `${x.skill_id} — ${x.name}` }))
    const recipes = await allRows<{ world_id: string; recipe_id: string; name: string }>(
      `select world_id, recipe_id, name from world.world_recipes`, [])
    add(recipes, 'recipe', (x) => ({ id: `${x.world_id}::${x.recipe_id}`, name: `${x.recipe_id} — ${x.name}` }))
  } else {
    const regions = await allRows<{ id: string; name: string }>(
      `select id, name from world.world_regions where world_id = $1`, [worldId])
    add(regions.map((r) => ({ world_id: worldId, ...r })), 'region', (x) => ({ id: `${x.world_id}::${x.id}`, name: `${x.id} (${x.name})` }))
    const rooms = await allRows<{ world_id: string; region_id: string; room_id: number; name: string }>(
      `select world_id, region_id, room_id, name from world.world_rooms where world_id = $1`, [worldId])
    add(rooms, 'room', (x) => ({ id: `${x.world_id}::${x.region_id}::${x.room_id}`, name: `#${x.room_id} ${x.name}` }))
    const skills = await allRows<{ skill_id: string; name: string }>(
      `select skill_id, name from world.world_skills where world_id = $1`, [worldId])
    add(skills.map((s) => ({ world_id: worldId, ...s })), 'skill', (x) => ({ id: `${x.world_id}::${x.skill_id}`, name: `${x.skill_id} — ${x.name}` }))
    const recipes = await allRows<{ recipe_id: string; name: string }>(
      `select recipe_id, name from world.world_recipes where world_id = $1`, [worldId])
    add(recipes.map((r) => ({ world_id: worldId, ...r })), 'recipe', (x) => ({ id: `${x.world_id}::${x.recipe_id}`, name: `${x.recipe_id} — ${x.name}` }))
  }

  return results.slice(0, limit)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const rawType = String(query.type ?? '').trim().toLowerCase()
  const type = VALID_TYPES.has(rawType) ? rawType : null
  const worldId = String(query.world_id ?? '')
  const limit = Math.min(Number(query.limit ?? 25) || 25, 100)

  const results = await runQuery({ type, q, worldId, limit })

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
