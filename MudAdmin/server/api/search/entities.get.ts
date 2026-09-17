import { getDb } from '../../utils/db'

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

function runQuery(args: QueryArgs): SearchResult[] {
  const { type, q, worldId, limit } = args
  const results: SearchResult[] = []
  const db = getDb()

  const add = <T extends { world_id: string } & Record<string, unknown>>(
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

  if (type === 'mob' || (!type && !worldId)) {
    const rows = worldId
      ? db.prepare(`select world_id, template_id, name from world_mobs where world_id = ?`).all(worldId) as Array<{ world_id: string; template_id: string; name: string }>
      : db.prepare(`select world_id, template_id, name from world_mobs`).all() as Array<{ world_id: string; template_id: string; name: string }>
    add(rows, 'mob', (r) => ({ id: `${r.world_id}::${r.template_id}`, name: `${r.template_id} — ${r.name}` }))
    if (type === 'mob') return results.slice(0, limit)
  }

  if (type === 'npc') {
    const rows = worldId
      ? db.prepare(`select world_id, template_id, name from world_mobs where world_id = ? and ai = 'passive'`).all(worldId) as Array<{ world_id: string; template_id: string; name: string }>
      : db.prepare(`select world_id, template_id, name from world_mobs where ai = 'passive'`).all() as Array<{ world_id: string; template_id: string; name: string }>
    add(rows, 'npc', (r) => ({ id: `${r.world_id}::${r.template_id}`, name: `${r.template_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'item' || (!type && !worldId)) {
    const rows = worldId
      ? db.prepare(`select world_id, template_id, name from world_items where world_id = ?`).all(worldId) as Array<{ world_id: string; template_id: string; name: string }>
      : db.prepare(`select world_id, template_id, name from world_items`).all() as Array<{ world_id: string; template_id: string; name: string }>
    add(rows, 'item', (r) => ({ id: `${r.world_id}::${r.template_id}`, name: `${r.template_id} — ${r.name}` }))
    if (type === 'item') return results.slice(0, limit)
  }

  if (type === 'quest' || (!type && !worldId)) {
    const rows = worldId
      ? db.prepare(`select world_id, quest_id, name from world_quests where world_id = ?`).all(worldId) as Array<{ world_id: string; quest_id: string; name: string }>
      : db.prepare(`select world_id, quest_id, name from world_quests`).all() as Array<{ world_id: string; quest_id: string; name: string }>
    add(rows, 'quest', (r) => ({ id: `${r.world_id}::${r.quest_id}`, name: `${r.quest_id} — ${r.name}` }))
    if (type === 'quest') return results.slice(0, limit)
  }

  if (type === 'region') {
    const rows = worldId
      ? db.prepare(`select world_id, id, name from world_regions where world_id = ?`).all(worldId) as Array<{ world_id: string; id: string; name: string }>
      : db.prepare(`select world_id, id, name from world_regions`).all() as Array<{ world_id: string; id: string; name: string }>
    add(rows, 'region', (r) => ({ id: `${r.world_id}::${r.id}`, name: `${r.id} (${r.name})` }))
    return results.slice(0, limit)
  }

  if (type === 'skill') {
    const rows = worldId
      ? db.prepare(`select world_id, skill_id, name from world_skills where world_id = ?`).all(worldId) as Array<{ world_id: string; skill_id: string; name: string }>
      : db.prepare(`select world_id, skill_id, name from world_skills`).all() as Array<{ world_id: string; skill_id: string; name: string }>
    add(rows, 'skill', (r) => ({ id: `${r.world_id}::${r.skill_id}`, name: `${r.skill_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'recipe') {
    const rows = worldId
      ? db.prepare(`select world_id, recipe_id, name from world_recipes where world_id = ?`).all(worldId) as Array<{ world_id: string; recipe_id: string; name: string }>
      : db.prepare(`select world_id, recipe_id, name from world_recipes`).all() as Array<{ world_id: string; recipe_id: string; name: string }>
    add(rows, 'recipe', (r) => ({ id: `${r.world_id}::${r.recipe_id}`, name: `${r.recipe_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (type === 'room') {
    const rows = worldId
      ? db.prepare(`select world_id, region_id, room_id, name from world_rooms where world_id = ?`).all(worldId) as Array<{ world_id: string; region_id: string; room_id: number; name: string }>
      : db.prepare(`select world_id, region_id, room_id, name from world_rooms`).all() as Array<{ world_id: string; region_id: string; room_id: number; name: string }>
    add(rows, 'room', (r) => ({
      id: `${r.world_id}::${r.region_id}::${r.room_id}`,
      name: `#${r.room_id} ${r.name}`,
    }))
    return results.slice(0, limit)
  }

  if (type === 'interactable') {
    const rows = worldId
      ? db.prepare(`select world_id, template_id, name from world_interactables where world_id = ?`).all(worldId) as Array<{ world_id: string; template_id: string; name: string }>
      : db.prepare(`select world_id, template_id, name from world_interactables`).all() as Array<{ world_id: string; template_id: string; name: string }>
    add(rows, 'interactable', (r) => ({ id: `${r.world_id}::${r.template_id}`, name: `${r.template_id} — ${r.name}` }))
    return results.slice(0, limit)
  }

  if (!worldId || worldId === 'all') {
    for (const r of db.prepare(`select world_id, id, name from world_regions`).all() as Array<{ world_id: string; id: string; name: string }>) {
      add([r], 'region', (x) => ({ id: `${x.world_id}::${x.id}`, name: `${x.id} (${x.name})` }))
    }
    for (const r of db.prepare(`select world_id, skill_id, name from world_skills`).all() as Array<{ world_id: string; skill_id: string; name: string }>) {
      add([r], 'skill', (x) => ({ id: `${x.world_id}::${x.skill_id}`, name: `${x.skill_id} — ${x.name}` }))
    }
    for (const r of db.prepare(`select world_id, recipe_id, name from world_recipes`).all() as Array<{ world_id: string; recipe_id: string; name: string }>) {
      add([r], 'recipe', (x) => ({ id: `${x.world_id}::${x.recipe_id}`, name: `${x.recipe_id} — ${x.name}` }))
    }
  } else {
    for (const r of db.prepare(`select id, name from world_regions where world_id = ?`).all(worldId) as Array<{ id: string; name: string }>) {
      add([{ world_id: worldId, ...r }], 'region', (x) => ({ id: `${x.world_id}::${x.id}`, name: `${x.id} (${x.name})` }))
    }
    for (const r of db.prepare(`select world_id, region_id, room_id, name from world_rooms where world_id = ?`).all(worldId) as Array<{ world_id: string; region_id: string; room_id: number; name: string }>) {
      add([r], 'room', (x) => ({ id: `${x.world_id}::${x.region_id}::${x.room_id}`, name: `#${x.room_id} ${x.name}` }))
    }
    for (const r of db.prepare(`select skill_id, name from world_skills where world_id = ?`).all(worldId) as Array<{ skill_id: string; name: string }>) {
      add([{ world_id: worldId, ...r }], 'skill', (x) => ({ id: `${x.world_id}::${x.skill_id}`, name: `${x.skill_id} — ${x.name}` }))
    }
    for (const r of db.prepare(`select recipe_id, name from world_recipes where world_id = ?`).all(worldId) as Array<{ recipe_id: string; name: string }>) {
      add([{ world_id: worldId, ...r }], 'recipe', (x) => ({ id: `${x.world_id}::${x.recipe_id}`, name: `${x.recipe_id} — ${x.name}` }))
    }
  }

  return results.slice(0, limit)
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const rawType = String(query.type ?? '').trim().toLowerCase()
  const type = VALID_TYPES.has(rawType) ? rawType : null
  const worldId = String(query.world_id ?? '')
  const limit = Math.min(Number(query.limit ?? 25) || 25, 100)

  const results = runQuery({ type, q, worldId, limit })

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
