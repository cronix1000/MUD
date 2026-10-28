import { getPool } from './db'

export interface EntityRecord {
  entity_type: string
  entity_id: string
  doc: Record<string, unknown>
  parent_id: string | null
  mod_origin: string | null
  updated_at: string
}

export function parseDoc(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('doc must be a JSON object')
    }
    return parsed as Record<string, unknown>
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  throw new Error('doc must be a JSON object')
}

export async function listEntities(
  type: string,
  opts: { q?: string; limit?: number; offset?: number; sort?: string } = {},
): Promise<EntityRecord[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500)
  const offset = Math.max(opts.offset ?? 0, 0)
  const params: unknown[] = []
  let where: string
  if (opts.q) {
    params.push(`%${opts.q.toLowerCase()}%`, type)
    where = `entity_type = $2 AND (lower(entity_id) LIKE $1 OR lower(doc->>'name') LIKE $1)`
  } else {
    params.push(type)
    where = `entity_type = $1`
  }
  const orderBy: Record<string, string> = {
    id: 'entity_id',
    name: `lower(doc->>'name') NULLS LAST, entity_id`,
    updated: 'updated_at DESC, entity_id',
  }
  params.push(limit, offset)
  const res = await getPool().query<EntityRecord>(
    `SELECT entity_type, entity_id, doc, parent_id, mod_origin, updated_at
       FROM world.entities
      WHERE ${where}
      ORDER BY ${orderBy[opts.sort ?? 'id'] ?? orderBy.id}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )
  return res.rows
}

export async function countEntities(type: string, q?: string): Promise<number> {
  const params: unknown[] = []
  let where: string
  if (q) {
    params.push(`%${q.toLowerCase()}%`, type)
    where = `entity_type = $2 AND (lower(entity_id) LIKE $1 OR lower(doc->>'name') LIKE $1)`
  } else {
    params.push(type)
    where = `entity_type = $1`
  }
  const res = await getPool().query<{ c: string }>(
    `SELECT count(*)::text AS c FROM world.entities WHERE ${where}`,
    params,
  )
  return Number(res.rows[0]?.c ?? 0)
}

export async function getEntity(type: string, id: string): Promise<EntityRecord | null> {
  const res = await getPool().query<EntityRecord>(
    `SELECT entity_type, entity_id, doc, parent_id, mod_origin, updated_at
       FROM world.entities
      WHERE entity_type = $1 AND entity_id = $2`,
    [type, id],
  )
  return res.rows[0] ?? null
}

async function assertValidParent(type: string, id: string, parentId: string) {
  if (parentId === id) {
    throw new Error('parent_id cannot reference itself')
  }
  const seen = new Set<string>([id])
  let cur: string | null = parentId
  for (let hop = 0; cur && hop < 100; hop++) {
    if (seen.has(cur)) {
      throw new Error('parent_id chain contains a cycle')
    }
    const res = await getPool().query<{ parent_id: string | null }>(
      `SELECT parent_id FROM world.entities WHERE entity_type = $1 AND entity_id = $2`,
      [type, cur],
    )
    const row = res.rows[0]
    if (!row) {
      throw new Error(`parent '${cur}' does not exist`)
    }
    seen.add(cur)
    cur = row.parent_id
  }
  if (cur) {
    throw new Error('parent_id chain too deep (possible cycle)')
  }
}

export async function upsertEntity(
  type: string,
  id: string,
  doc: Record<string, unknown>,
  parentId: string | null = null,
): Promise<EntityRecord> {
  const trimmedParent = parentId?.trim() || null
  if (trimmedParent) {
    await assertValidParent(type, id, trimmedParent)
  }
  const res = await getPool().query<EntityRecord>(
    `INSERT INTO world.entities (entity_type, entity_id, doc, parent_id, mod_origin, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, 'admin', now())
     ON CONFLICT (entity_type, entity_id) DO UPDATE
       SET doc = EXCLUDED.doc, parent_id = EXCLUDED.parent_id, mod_origin = 'admin', updated_at = now()
     RETURNING entity_type, entity_id, doc, parent_id, mod_origin, updated_at`,
    [type, id, JSON.stringify(doc), trimmedParent],
  )
  return res.rows[0]!
}

export async function deleteEntity(type: string, id: string): Promise<boolean> {
  const res = await getPool().query(
    `DELETE FROM world.entities WHERE entity_type = $1 AND entity_id = $2`,
    [type, id],
  )
  return (res.rowCount ?? 0) > 0
}

export async function deleteEntitiesBulk(type: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0
  const res = await getPool().query(
    `DELETE FROM world.entities WHERE entity_type = $1 AND entity_id = ANY($2)`,
    [type, ids],
  )
  return res.rowCount ?? 0
}

export async function entityCounts(): Promise<Record<string, number>> {
  const res = await getPool().query<{ entity_type: string; c: string }>(
    `SELECT entity_type, count(*)::text AS c FROM world.entities GROUP BY entity_type`,
  )
  const out: Record<string, number> = {}
  for (const r of res.rows) out[r.entity_type] = Number(r.c)
  return out
}
