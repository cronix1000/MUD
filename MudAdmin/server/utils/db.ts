import pg from 'pg'
import { COMPOSITE_KEYS } from './composite-key'

let _pool: pg.Pool | null = null

const ALLOWED_TABLES = new Set([
  'player_players',
  'player_items',
  'player_known_recipes',
  'world_worlds',
  'world_regions',
  'world_rooms',
  'world_room_exits',
  'world_room_spawns',
  'world_terrains',
  'world_items',
  'world_mobs',
  'world_interactables',
  'world_loot_tables',
  'world_skill_categories',
  'world_skills',
  'world_dialogues',
  'world_field_definitions',
  'world_region_overrides',
  'world_quests',
  'world_quest_objectives',
  'world_quest_rewards',
  'world_recipes',
])

function defaultConnectionString(): string {
  const url = process.env.MUD_DATABASE_URL
  if (!url) {
    throw new Error(
      'MUD_DATABASE_URL is required (e.g. postgresql://mud_prod:...@postgres:5432/mud_prod?options=-c%20search_path=world,players,_meta,public). ' +
      'See docker/.env.example for the full template.',
    )
  }
  return url
}

export function getPool(): pg.Pool {
  if (_pool) return _pool
  _pool = new pg.Pool({ connectionString: defaultConnectionString() })
  return _pool
}

export function assertTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown table: ${table}` })
  }
}

function qualified(table: string): string {
  if (table.startsWith('player_')) return `players.${table}`
  if (table.startsWith('_')) return `_meta.${table}`
  return `world.${table}`
}

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: 0 | 1
  dflt_value: unknown
  pk: 0 | 1
}

function schemaFor(table: string): 'world' | 'players' | '_meta' {
  if (table.startsWith('player_')) return 'players'
  if (table.startsWith('_')) return '_meta'
  return 'world'
}

export async function getColumns(table: string): Promise<ColumnInfo[]> {
  assertTable(table)
  const schema = schemaFor(table)
  const res = await getPool().query<{
    ordinal_position: number
    column_name: string
    data_type: string
    is_nullable: 'YES' | 'NO'
    column_default: string | null
  }>(
    `SELECT ordinal_position, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position`,
    [schema, table],
  )
  return res.rows.map((r) => ({
    cid: Number(r.ordinal_position) - 1,
    name: r.column_name,
    type: r.data_type,
    notnull: r.is_nullable === 'NO' ? 1 : 0,
    dflt_value: r.column_default,
    pk: 0,
  }))
}

async function getPrimaryKeyColumn(table: string): Promise<string | null> {
  const schema = schemaFor(table)
  const res = await getPool().query<{ column_name: string }>(
    `SELECT a.attname AS column_name
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2 AND i.indisprimary`,
    [schema, table],
  )
  return res.rows[0]?.column_name ?? null
}

function isComposite(table: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMPOSITE_KEYS, table)
}

function buildWhere(table: string, id: unknown): { sql: string; params: unknown[] } {
  const spec = COMPOSITE_KEYS[table]
  if (spec) {
    if (!id || typeof id !== 'object') {
      throw createError({ statusCode: 400, statusMessage: `${table} requires composite key object` })
    }
    const parts = spec.fields.map((f) => `${f} = $1`)
    return {
      sql: parts.join(' and '),
      params: [spec.fields.map((f) => (id as Record<string, unknown>)[f])],
    }
  }
  throw createError({
    statusCode: 400,
    statusMessage: `Table ${table} is missing composite key spec (PK discovery is async; use composite-key helpers)`,
  })
}

function buildWhereFromId(table: string, id: unknown, pkColumn: string): { sql: string; params: unknown[] } {
  return { sql: `${pkColumn} = $1`, params: [id] }
}

export async function listRows(table: string, limit = 100, offset = 0) {
  assertTable(table)
  const res = await getPool().query(
    `select * from ${qualified(table)} limit $1 offset $2`,
    [limit, offset],
  )
  return res.rows
}

export async function getRow(table: string, id: unknown) {
  assertTable(table)
  if (isComposite(table)) {
    const w = buildWhere(table, id)
    const res = await getPool().query(
      `select * from ${qualified(table)} where ${w.sql}`,
      w.params,
    )
    return res.rows[0] ?? null
  }
  const pk = await getPrimaryKeyColumn(table)
  if (!pk) throw createError({ statusCode: 400, statusMessage: `Table ${table} has no PK` })
  const w = buildWhereFromId(table, id, pk)
  const res = await getPool().query(
    `select * from ${qualified(table)} where ${w.sql}`,
    w.params,
  )
  return res.rows[0] ?? null
}

export async function insertRow(table: string, body: Record<string, unknown>) {
  assertTable(table)
  const cols = await getColumns(table)
  const colNames = cols.map((c) => c.name)
  const payload = await coercePayload(table, body)

  const spec = COMPOSITE_KEYS[table]
  const singlePk = spec ? null : await getPrimaryKeyColumn(table)
  const pkFields = spec ? spec.fields : singlePk ? [singlePk] : []
  if (pkFields.length === 0) {
    throw createError({ statusCode: 400, statusMessage: `Table ${table} has no PK` })
  }

  const requiredPkFields = pkFields.filter((f) => {
    if (spec) return true
    const col = cols.find((c) => c.name === f)
    if (!col) return true
    return !(col.type.toLowerCase().includes('integer') && /serial|bigserial|identity/.test(col.dflt_value?.toString() ?? ''))
  })
  for (const f of requiredPkFields) {
    if (payload[f] === undefined) {
      throw createError({ statusCode: 400, statusMessage: `Missing PK field(s) for ${table}: ${f}` })
    }
  }

  const validKeys = Object.keys(payload).filter((k) => colNames.includes(k))
  if (validKeys.length === 0) throw createError({ statusCode: 400, statusMessage: 'No valid columns' })

  const placeholders = validKeys.map((_, i) => `$${i + 1}`).join(', ')
  const hasJsonb = validKeys.some((k) => isJsonColumn(k))
  const returningClause = singlePk && !validKeys.includes(singlePk) ? ` RETURNING ${singlePk}` : ''
  const sql = `insert into ${qualified(table)} (${validKeys.join(', ')}) values (${placeholders})${returningClause}`
  const values = validKeys.map((k) => payload[k])
  const res = await getPool().query(sql, values)
  return { id: res.rows[0]?.[singlePk ?? ''] ?? null, changes: res.rowCount ?? 0, _hasJsonb: hasJsonb }
}

export async function updateRow(table: string, id: unknown, body: Record<string, unknown>) {
  assertTable(table)
  const cols = await getColumns(table)
  const colNames = cols.map((c) => c.name)
  const payload = await coercePayload(table, body)
  const spec = COMPOSITE_KEYS[table]
  const singlePk = spec ? null : await getPrimaryKeyColumn(table)
  const pkFields = spec ? spec.fields : singlePk ? [singlePk] : []
  if (pkFields.length === 0) {
    throw createError({ statusCode: 400, statusMessage: `Table ${table} has no PK` })
  }
  const validKeys = Object.keys(payload).filter((k) => colNames.includes(k) && !pkFields.includes(k))
  if (validKeys.length === 0) throw createError({ statusCode: 400, statusMessage: 'No updatable columns' })

  const setSql = validKeys.map((k, i) => `${k} = $${i + 1}`).join(', ')
  const w = isComposite(table)
    ? buildWhere(table, id)
    : buildWhereFromId(table, id, singlePk!)
  const baseIdx = validKeys.length
  const whereSql = isComposite(table)
    ? w.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + baseIdx}`)
    : `${singlePk} = $${baseIdx + 1}`
  const params = isComposite(table)
    ? [...validKeys.map((k) => payload[k]), ...w.params[0] as unknown[]]
    : [...validKeys.map((k) => payload[k]), (w.params as unknown[])[0]]
  const res = await getPool().query(
    `update ${qualified(table)} set ${setSql} where ${whereSql}`,
    params,
  )
  return { changes: res.rowCount ?? 0 }
}

export async function deleteRow(table: string, id: unknown) {
  assertTable(table)
  if (isComposite(table)) {
    const w = buildWhere(table, id)
    const res = await getPool().query(
      `delete from ${qualified(table)} where ${w.sql}`,
      w.params,
    )
    return { changes: res.rowCount ?? 0 }
  }
  const pk = await getPrimaryKeyColumn(table)
  if (!pk) throw createError({ statusCode: 400, statusMessage: `Table ${table} has no PK` })
  const w = buildWhereFromId(table, id, pk)
  const res = await getPool().query(
    `delete from ${qualified(table)} where ${w.sql}`,
    w.params,
  )
  return { changes: res.rowCount ?? 0 }
}

function isJsonColumn(name: string): boolean {
  return name.endsWith('_json')
}

async function coercePayload(table: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cols = await getColumns(table)
  const colByName = new Map(cols.map((c) => [c.name, c]))
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(body)) {
    if (raw === undefined) continue
    const col = colByName.get(key)
    if (!col) continue
    if (raw === null) { out[key] = null; continue }
    if (isJsonColumn(col.name)) {
      if (typeof raw === 'string') {
        try {
          JSON.parse(raw)
          out[key] = raw
        } catch {
          throw createError({ statusCode: 400, statusMessage: `Column ${col.name} must be valid JSON` })
        }
      } else {
        out[key] = JSON.stringify(raw)
      }
      continue
    }
    const upper = col.type.toUpperCase()
    if (upper === 'INTEGER' || upper === 'BIGINT' || upper === 'SMALLINT') {
      const n = Number(raw)
      if (!Number.isFinite(n)) throw createError({ statusCode: 400, statusMessage: `Column ${col.name} must be numeric` })
      out[key] = Math.trunc(n)
      continue
    }
    if (upper === 'REAL' || upper === 'DOUBLE PRECISION' || upper === 'NUMERIC') {
      const n = Number(raw)
      if (!Number.isFinite(n)) throw createError({ statusCode: 400, statusMessage: `Column ${col.name} must be numeric` })
      out[key] = n
      continue
    }
    if (upper === 'BOOLEAN') {
      out[key] = raw === true || raw === 'true' || raw === 't' || raw === 1 || raw === '1'
      continue
    }
    out[key] = String(raw)
  }
  return out
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end()
    _pool = null
  }
}
