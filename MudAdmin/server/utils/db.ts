import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { COMPOSITE_KEYS } from './composite-key'

let _db: Database.Database | null = null

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

function derivePlayersPath(worldDbPath: string): string {
  const bakIdx = worldDbPath.indexOf('.bak.')
  const base = bakIdx >= 0 ? worldDbPath.slice(0, bakIdx) : worldDbPath
  const worldTok = '.world.db'
  const wpos = base.lastIndexOf(worldTok)
  if (wpos >= 0) {
    return base.slice(0, wpos) + '.players.db' + base.slice(wpos + worldTok.length)
  }
  if (base.endsWith('.db')) {
    return base.slice(0, -3) + '.players.db'
  }
  return base + '.players.db'
}

function ensurePlayersFile(playersDbPath: string): void {
  if (existsSync(playersDbPath)) return
  const tmp = new Database(playersDbPath)
  tmp.pragma('foreign_keys = ON')
  tmp.exec(`
    CREATE TABLE IF NOT EXISTS player_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region_id TEXT DEFAULT 'floor1',
      account_id INTEGER UNIQUE,
      permission INTEGER NOT NULL,
      name TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      room_id INTEGER DEFAULT 1,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS player_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      template_id TEXT NOT NULL,
      item_state TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES player_players(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS player_known_recipes (
      uid INTEGER NOT NULL,
      world_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      learned_at INTEGER NOT NULL,
      PRIMARY KEY (uid, world_id, recipe_id)
    );
  `)
  tmp.close()
}

export function getDb(): Database.Database {
  if (_db) return _db
  const configured = process.env.MUD_DB_PATH
  const candidates = [
    configured,
    resolve(process.cwd(), '..', 'ModularMudServer', 'mud.world.db'),
    resolve(process.cwd(), '..', 'ModularMudServer', 'mud.db'),
    resolve(process.cwd(), 'ModularMudServer', 'mud.world.db'),
    resolve(process.cwd(), 'ModularMudServer', 'mud.db'),
  ].filter(Boolean) as string[]
  const found = candidates.find((p) => existsSync(p))
  if (!found) {
    throw new Error(
      `mud.db not found. Tried:\n${candidates.join('\n')}\nSet MUD_DB_PATH to override.`,
    )
  }

  _db = new Database(found, { readonly: false, fileMustExist: true })
  _db.pragma('foreign_keys = ON')

  const playersPath = process.env.MUD_PLAYERS_DB ?? derivePlayersPath(found)
  const worldIsSplit = playersPath !== found && playersPath !== found.replace(/\.world\.db\b/, '.db') === false

  if (!existsSync(playersPath)) {
    try {
      ensurePlayersFile(playersPath)
      console.log(`[db] created players DB at ${playersPath}`)
    } catch (e) {
      console.warn(`[db] could not create players DB at ${playersPath}:`, e)
      return _db
    }
  }

  try {
    _db.exec(`ATTACH DATABASE '${playersPath.replace(/'/g, "''")}' AS players`)
    _db.exec(`
      CREATE TABLE IF NOT EXISTS players.player_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        region_id TEXT DEFAULT 'floor1',
        account_id INTEGER UNIQUE,
        permission INTEGER NOT NULL,
        name TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        room_id INTEGER DEFAULT 1,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS players.player_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        template_id TEXT NOT NULL,
        item_state TEXT NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES player_players(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS players.player_known_recipes (
        uid INTEGER NOT NULL,
        world_id TEXT NOT NULL,
        recipe_id TEXT NOT NULL,
        learned_at INTEGER NOT NULL,
        PRIMARY KEY (uid, world_id, recipe_id)
      );
    `)
    console.log(`[db] attached players DB from ${playersPath}`)
  } catch (e) {
    console.warn(`[db] could not attach players DB:`, e)
  }

  return _db
}

export function assertTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown table: ${table}` })
  }
}

function qualified(table: string): string {
  if (table.startsWith('player_')) return `players.${table}`
  return table
}

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: 0 | 1
  dflt_value: unknown
  pk: 0 | 1
}

export function getColumns(table: string): ColumnInfo[] {
  assertTable(table)
  return getDb().prepare(`pragma table_info(${qualified(table)})`).all() as ColumnInfo[]
}

export function getPrimaryKey(table: string): string | null {
  const cols = getColumns(table)
  const pk = cols.find((c) => c.pk === 1)
  return pk?.name ?? null
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
    const parts = spec.fields.map((f) => `${f} = ?`)
    return { sql: parts.join(' and '), params: spec.fields.map((f) => (id as Record<string, unknown>)[f]) }
  }
  const pk = getPrimaryKey(table)
  if (!pk) throw createError({ statusCode: 400, statusMessage: `Table ${table} has no PK` })
  return { sql: `${pk} = ?`, params: [id] }
}

export function listRows(table: string, limit = 100, offset = 0) {
  assertTable(table)
  return getDb()
    .prepare(`select * from ${qualified(table)} limit ? offset ?`)
    .all(limit, offset)
}

export function getRow(table: string, id: unknown) {
  assertTable(table)
  const w = buildWhere(table, id)
  return getDb()
    .prepare(`select * from ${qualified(table)} where ${w.sql}`)
    .get(...w.params)
}

export function insertRow(table: string, body: Record<string, unknown>) {
  assertTable(table)
  const cols = getColumns(table)
  const colNames = cols.map((c) => c.name)
  const payload = coercePayload(table, body)
  const spec = COMPOSITE_KEYS[table]
  const singlePk = getPrimaryKey(table)
  const pkFields = spec ? spec.fields : singlePk ? [singlePk] : []
  if (pkFields.length === 0) throw createError({ statusCode: 400, statusMessage: `Table ${table} has no PK` })

  const requiredPkFields = pkFields.filter((f) => {
    if (spec) return true
    const col = cols.find((c) => c.name === f)
    if (!col) return true
    return !(col.type.toUpperCase().includes('INTEGER') && col.pk === 1)
  })
  if (requiredPkFields.some((f) => payload[f] === undefined)) {
    throw createError({ statusCode: 400, statusMessage: `Missing PK field(s) for ${table}: ${requiredPkFields.join(', ')}` })
  }

  const validKeys = Object.keys(payload).filter((k) => colNames.includes(k))
  if (validKeys.length === 0) throw createError({ statusCode: 400, statusMessage: 'No valid columns' })
  const placeholders = validKeys.map(() => '?').join(', ')
  const stmt = getDb().prepare(
    `insert into ${qualified(table)} (${validKeys.join(', ')}) values (${placeholders})`,
  )
  const info = stmt.run(...validKeys.map((k) => payload[k]))
  return { id: info.lastInsertRowid, changes: info.changes }
}

export function updateRow(table: string, id: unknown, body: Record<string, unknown>) {
  assertTable(table)
  const cols = getColumns(table).map((c) => c.name)
  const payload = coercePayload(table, body)
  const spec = COMPOSITE_KEYS[table]
  const pkFromSingle = getPrimaryKey(table)
  const pkFields = spec ? spec.fields : pkFromSingle ? [pkFromSingle] : []
  if (pkFields.length === 0) throw createError({ statusCode: 400, statusMessage: `Table ${table} has no PK` })
  const validKeys = Object.keys(payload).filter((k) => cols.includes(k) && !pkFields.includes(k))
  if (validKeys.length === 0) throw createError({ statusCode: 400, statusMessage: 'No updatable columns' })
  const set = validKeys.map((k) => `${k} = ?`).join(', ')
  const w = buildWhere(table, id)
  const stmt = getDb().prepare(`update ${qualified(table)} set ${set} where ${w.sql}`)
  const info = stmt.run(...validKeys.map((k) => payload[k]), ...w.params)
  return { changes: info.changes }
}

export function deleteRow(table: string, id: unknown) {
  assertTable(table)
  const w = buildWhere(table, id)
  const info = getDb().prepare(`delete from ${qualified(table)} where ${w.sql}`).run(...w.params)
  return { changes: info.changes }
}

function coercePayload(table: string, body: Record<string, unknown>): Record<string, unknown> {
  const cols = getColumns(table)
  const colByName = new Map(cols.map((c) => [c.name, c]))
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(body)) {
    if (raw === undefined) continue
    const col = colByName.get(key)
    if (!col) continue
    if (raw === null) { out[key] = null; continue }
    if (isJsonColumn(col.name)) {
      if (typeof raw === 'string') {
        try { JSON.parse(raw); out[key] = raw } catch { throw createError({ statusCode: 400, statusMessage: `Column ${col.name} must be valid JSON` }) }
      } else {
        out[key] = JSON.stringify(raw)
      }
      continue
    }
    const upper = col.type.toUpperCase()
    if (upper === 'INTEGER') {
      const n = Number(raw)
      if (!Number.isFinite(n)) throw createError({ statusCode: 400, statusMessage: `Column ${col.name} must be numeric` })
      out[key] = Math.trunc(n)
      continue
    }
    if (upper === 'REAL') {
      const n = Number(raw)
      if (!Number.isFinite(n)) throw createError({ statusCode: 400, statusMessage: `Column ${col.name} must be numeric` })
      out[key] = n
      continue
    }
    out[key] = String(raw)
  }
  return out
}

function isJsonColumn(name: string): boolean {
  return name.endsWith('_json')
}
