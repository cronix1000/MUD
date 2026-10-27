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
  fk: { schema: string; table: string; column: string } | null
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
    is_pk: number
    fk_schema: string | null
    fk_table: string | null
    fk_column: string | null
  }>(
    `WITH t AS (
         SELECT ($1::text || '.' || $2::text)::regclass AS relid,
                $1::text AS schema_name,
                $2::text AS table_name
       ),
       cols AS (
         SELECT c.ordinal_position, c.column_name, c.data_type, c.is_nullable, c.column_default,
                a.attnum, a.attidentity,
                (SELECT 1
                  FROM pg_index i
                 WHERE i.indrelid = t.relid
                   AND a.attnum = ANY(i.indkey)
                   AND i.indisprimary
                 LIMIT 1) AS is_pk
           FROM information_schema.columns c
           CROSS JOIN t
           LEFT JOIN pg_attribute a
             ON a.attrelid = t.relid
            AND a.attname = c.column_name
          WHERE c.table_schema = t.schema_name AND c.table_name = t.table_name
       )
       SELECT cols.ordinal_position, cols.column_name, cols.data_type, cols.is_nullable,
              cols.column_default, COALESCE(cols.attidentity, '') AS attidentity,
              COALESCE(cols.is_pk, 0) AS is_pk,
              fk.fk_schema, fk.fk_table, fk.fk_column
         FROM cols
         LEFT JOIN LATERAL (
           SELECT n.nspname AS fk_schema, ct.relname AS fk_table, ca.attname AS fk_column
             FROM pg_constraint con
             JOIN pg_class ct ON ct.oid = con.confrelid
             JOIN pg_namespace n ON n.oid = ct.relnamespace
             JOIN pg_attribute ca ON ca.attrelid = con.confrelid AND ca.attnum = con.confkey[1]
            WHERE con.conrelid = (SELECT relid FROM t)
              AND con.contype = 'f'
              AND ca.attname = cols.column_name
            LIMIT 1
         ) fk ON true
        ORDER BY cols.ordinal_position`,
    [schema, table],
  )
  return res.rows.map((r) => ({
    cid: Number(r.ordinal_position) - 1,
    name: r.column_name,
    type: r.data_type,
    notnull: r.is_nullable === 'NO' ? 1 : 0,
    dflt_value: r.column_default,
    pk: (r.is_pk ? 1 : 0) as 0 | 1,
    is_identity: r.attidentity === 'a' || r.attidentity === 'd' ? 1 : 0,
    fk: r.fk_schema && r.fk_table && r.fk_column
      ? { schema: r.fk_schema, table: r.fk_table, column: r.fk_column }
      : null,
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
    const col = cols.find((c) => c.name === f)
    if (!col) return true
    return !isAutoIntColumn(col)
  })
  for (const f of requiredPkFields) {
    if (payload[f] === undefined) {
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
  const returningCol = singlePk
    || (spec ? spec.fields.find((f) => cols.find((c) => c.name === f && isAutoIntColumn(c))) : null)
  const returningClause = returningCol && !validKeys.includes(returningCol) ? ` RETURNING ${returningCol}` : ''
  const sql = `insert into ${qualified(table)} (${validKeys.join(', ')}) values (${placeholders})${returningClause}`
  const values = validKeys.map((k) => payload[k])

  try {
    const res = await getPool().query(sql, values)
    return { id: res.rows[0]?.[returningCol ?? ''] ?? null, changes: res.rowCount ?? 0, _hasJsonb: hasJsonb }
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

function isJsonType(type: string): boolean {
  const t = type.toUpperCase()
  return t === 'JSON' || t === 'JSONB'
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
    if (isJsonColumn(col.name) || isJsonType(col.type)) {
      let normalized: string
      if (typeof raw === 'string') {
        if (raw.trim() === '') {
          out[key] = null
          continue
        }
        try {
          JSON.parse(raw)
          normalized = raw
        } catch {
          throw createError({ statusCode: 400, statusMessage: `Column ${col.name} must be valid JSON` })
        }
      } else if (raw && typeof raw === 'object') {
        normalized = JSON.stringify(raw)
      } else {
        normalized = JSON.stringify(raw)
      }
      out[key] = normalized
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
