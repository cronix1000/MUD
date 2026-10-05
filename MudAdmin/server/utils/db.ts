import pg from 'pg'
import { COMPOSITE_KEYS } from './composite-key'

let _pool: pg.Pool | null = null

const ALLOWED_TABLES = new Set([
  'player_players',
  'player_items',
  'player_known_recipes',
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
  'world_zones',
])

function defaultConnectionString(): string {
  const url = process.env.MUD_DATABASE_URL
  console.log("url: "+ url)
  if (!url) {
    throw new Error(
      'MUD_DATABASE_URL is required (e.g. postgresql://mud_prod:...@postgres:5432/mud_prod). ' +
      'The search_path default is set at the role level by docker/postgresql/init/00-bootstrap.sh; ' +
      'see docker/.env.example for the full template.',
    )
  }
  return url
}

export function getPool(): pg.Pool {
  if (_pool) return _pool
  _pool = new pg.Pool({ connectionString: defaultConnectionString() })
  _pool.on('connect', (client) => {
    client.query('SET search_path TO world, players, _meta, public').catch((err) => {
      console.error('[db] failed to set search_path:', err)
    })
  })
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
  is_identity: 0 | 1
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
    attidentity: string
  }>(
    `SELECT c.ordinal_position, c.column_name, c.data_type, c.is_nullable, c.column_default,
            COALESCE(a.attidentity, '') AS attidentity
       FROM information_schema.columns c
       LEFT JOIN pg_attribute a
         ON a.attrelid = (c.table_schema || '.' || c.table_name)::regclass
        AND a.attname = c.column_name
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position`,
    [schema, table],
  )
  return res.rows.map((r) => ({
    cid: Number(r.ordinal_position) - 1,
    name: r.column_name,
    type: r.data_type,
    notnull: r.is_nullable === 'NO' ? 1 : 0,
    dflt_value: r.column_default,
    pk: 0,
    is_identity: r.attidentity === 'a' || r.attidentity === 'd' ? 1 : 0,
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
    const parts = spec.fields.map((f, i) => `${f} = $${i + 1}`)
    return {
      sql: parts.join(' and '),
      params: spec.fields.map((f) => (id as Record<string, unknown>)[f]),
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
    return !isAutoIntColumn(col)
  })
  for (const f of requiredPkFields) {
    if (payload[f] === undefined) {
      if (table === 'world_rooms' && f === 'room_id' && typeof payload.region_id === 'string') {
        payload.room_id = await assignNextRoomId(payload.region_id)
        continue
      }
      throw createError({ statusCode: 400, statusMessage: `Missing PK field(s) for ${table}: ${f}` })
    }
  }

  if (table === 'world_room_exits') {
    await assertExitTargetExists(
      payload.region_id,
      payload.to_room_id,
      payload.from_room_id,
    )
  }

  const validKeys = Object.keys(payload).filter((k) => colNames.includes(k))
  if (validKeys.length === 0) throw createError({ statusCode: 400, statusMessage: 'No valid columns' })

  const placeholders = validKeys.map((_, i) => `$${i + 1}`).join(', ')
  const hasJsonb = validKeys.some((k) => isJsonColumn(k))
  const returningClause = singlePk && !validKeys.includes(singlePk) ? ` RETURNING ${singlePk}` : ''
  const sql = `insert into ${qualified(table)} (${validKeys.join(', ')}) values (${placeholders})${returningClause}`
  const values = validKeys.map((k) => payload[k])

  const autoAssignedRoomId = table === 'world_rooms' && typeof payload.room_id === 'number'

  if (autoAssignedRoomId) {
    return await insertWorldRoomWithAutoId(payload, validKeys, hasJsonb)
  }

  try {
    const res = await getPool().query(sql, values)
    return { id: res.rows[0]?.[singlePk ?? ''] ?? null, changes: res.rowCount ?? 0, _hasJsonb: hasJsonb }
  } catch (err: unknown) {
    const e = err as { code?: string; constraint?: string; message?: string }
    if (e?.code === '23505') {
      const existing = spec && pkFields.every((f) => payload[f] !== undefined)
        ? await findExistingByPk(table, spec.fields, payload).catch(() => null)
        : null
      throw createError({
        statusCode: 409,
        statusMessage: `Row already exists in ${table}`,
        data: {
          table,
          pkFields: spec?.fields ?? (singlePk ? [singlePk] : []),
          pkValues: Object.fromEntries((spec?.fields ?? (singlePk ? [singlePk] : [])).map((f) => [f, payload[f]])),
          existing,
          hint: existing
            ? `A row with id ${existing.id ?? ''} already exists: "${existing.name ?? ''}". Pick a different id or open the existing one.`
            : 'A row with that key already exists.',
        },
      })
    }
    throw err
  }
}

async function insertWorldRoomWithAutoId(
  payload: Record<string, unknown>,
  validKeys: string[],
  hasJsonb: boolean,
): Promise<{ id: unknown; changes: number; _hasJsonb: boolean }> {
  const pool = getPool()
  const region_id = String(payload.region_id ?? '')
  const otherCols = validKeys.filter((k) => k !== 'region_id' && k !== 'room_id')
  const otherPlaceholders = otherCols.map((_, i) => `$${i + 3}`).join(', ')
  const insertSql = `INSERT INTO world.world_rooms (region_id, room_id${otherCols.length ? ', ' + otherCols.join(', ') : ''})
                     VALUES ($1, $2${otherCols.length ? ', ' + otherPlaceholders : ''})
                     RETURNING room_id`

  let lastErr: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED')
      const next = await client.query<{ id: number }>(
        `SELECT COALESCE(MAX(room_id), 0) + 1 AS id
           FROM world.world_rooms
          WHERE region_id = $1
          FOR UPDATE`,
        [region_id],
      )
      const id = Number(next.rows[0]?.id ?? 1)
      if (!Number.isSafeInteger(id) || id > 2_147_483_647) {
        throw createError({ statusCode: 400, statusMessage: `No free room_id in region ${region_id}` })
      }
      const params = [region_id, id, ...otherCols.map((k) => payload[k])]
      const res = await client.query(insertSql, params)
      await client.query('COMMIT')
      return {
        id: res.rows[0]?.room_id ?? id,
        changes: res.rowCount ?? 0,
        _hasJsonb: hasJsonb,
      }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      lastErr = err
      const e = err as { code?: string }
      if (e?.code !== '23505') throw err
    } finally {
      client.release()
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to insert world_room after retries')
}

async function findExistingByPk(table: string, fields: string[], payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const where = fields.map((f, i) => `${f} = $${i + 1}`).join(' and ')
  const values = fields.map((f) => payload[f])
  const res = await getPool().query(
    `select * from ${qualified(table)} where ${where} limit 1`,
    values,
  )
  return res.rows[0] ?? null
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

  if (table === 'world_room_exits' && payload.to_room_id !== undefined) {
    const existing = await getPool().query<{ region_id: string; from_room_id: number }>(
      `SELECT region_id, from_room_id FROM world.world_room_exits WHERE ${singlePk ? `${singlePk} = $1` : '1=0'} LIMIT 1`,
      [id],
    )
    const row = existing.rows[0]
    if (row) {
      await assertExitTargetExists(row.region_id, payload.to_room_id, row.from_room_id)
    }
  }

  const setSql = validKeys.map((k, i) => `${k} = $${i + 1}`).join(', ')
  const w = isComposite(table)
    ? buildWhere(table, id)
    : buildWhereFromId(table, id, singlePk!)
  const baseIdx = validKeys.length
  const whereSql = isComposite(table)
    ? w.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + baseIdx}`)
    : `${singlePk} = $${baseIdx + 1}`
  const params = isComposite(table)
    ? [...validKeys.map((k) => payload[k]), ...w.params]
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

function isAutoIntColumn(col: ColumnInfo): boolean {
  if (col.is_identity === 1) return true
  const t = col.type.toLowerCase()
  if (!(t === 'integer' || t === 'bigint' || t === 'smallint')) return false
  const def = (col.dflt_value?.toString() ?? '').toLowerCase()
  return /nextval\(/.test(def) || /\b(serial|bigserial|identity)\b/.test(def)
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

async function assignNextRoomId(region_id: string): Promise<number> {
  const pool = getPool()
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED')
      const next = await client.query<{ id: number }>(
        `SELECT COALESCE(MAX(room_id), 0) + 1 AS id
           FROM world.world_rooms
          WHERE region_id = $1
          FOR UPDATE`,
        [region_id],
      )
      const id = Number(next.rows[0]?.id ?? 1)
      if (!Number.isSafeInteger(id) || id > 2_147_483_647) {
        throw createError({ statusCode: 400, statusMessage: `No free room_id in region ${region_id}` })
      }
      await client.query('COMMIT')
      return id
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      lastErr = err
    } finally {
      client.release()
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to assign room_id')
}

async function assertExitTargetExists(
  region_id: unknown,
  to_room_id: unknown,
  from_room_id: unknown,
): Promise<void> {
  if (region_id === undefined || region_id === null) return
  if (to_room_id === undefined || to_room_id === null) return
  if (Number(to_room_id) === Number(from_room_id)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Exit cannot target its own room (${region_id}::${to_room_id})`,
    })
  }
  const pool = getPool()
  const r = await pool.query<{ exists: number }>(
    `SELECT 1 AS exists FROM world.world_rooms WHERE region_id = $1 AND room_id = $2 LIMIT 1`,
    [region_id, Math.trunc(Number(to_room_id))],
  )
  if (!r.rows.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `Exit target ${region_id}::${to_room_id} does not exist`,
    })
  }
}
