#!/usr/bin/env node
import Database from 'better-sqlite3'
import { existsSync, copyFileSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
function arg(name, def) {
  const flag = `--${name}`
  const i = args.indexOf(flag)
  if (i >= 0 && i + 1 < args.length) return args[i + 1]
  return def
}

const serverDir = arg('server-dir', resolve(process.cwd(), 'ModularMudServer'))
const srcPath   = arg('src',      resolve(serverDir, 'mud.db'))
const worldPath = arg('world',    resolve(serverDir, 'mud.world.db'))
const playersPath = arg('players', resolve(serverDir, 'mud.players.db'))

if (!existsSync(srcPath)) {
  console.error(`Source DB not found: ${srcPath}`)
  process.exit(1)
}
if (existsSync(worldPath)) {
  console.error(`Refusing to overwrite existing ${worldPath}`)
  process.exit(2)
}
if (existsSync(playersPath)) {
  console.error(`Refusing to overwrite existing ${playersPath}`)
  process.exit(2)
}

const ts = new Date().toISOString().replace(/[:.]/g, '-')

const backupPath = `${srcPath}.presplit.${ts}.bak`
console.log(`[1/5] backup: ${srcPath} -> ${backupPath}`)
copyFileSync(srcPath, backupPath)

console.log(`[2/5] open src: ${srcPath}`)
const src = new Database(srcPath, { fileMustExist: true })
src.pragma('foreign_keys = OFF')

function tableExists(db, table) {
  try { db.prepare(`select 1 from ${table} limit 1`).get(); return true } catch { return false }
}
function rowCount(db, table) {
  if (!tableExists(db, table)) return 0
  return db.prepare(`select count(*) c from ${table}`).get().c
}

const countsSrc = {
  player_players: rowCount(src, 'player_players'),
  player_items: rowCount(src, 'player_items'),
  player_known_recipes: rowCount(src, 'player_known_recipes'),
  _migrations: rowCount(src, '_migrations'),
}
console.log('[2/5] row counts in src:', countsSrc)

console.log(`[3/5] build world DB at ${worldPath}`)
const world = new Database(worldPath)
world.pragma('foreign_keys = ON')
world.exec(`ATTACH DATABASE '${srcPath.replace(/'/g, "''")}' AS src`)

const allSrcTables = world.prepare(`select name from src.sqlite_master where type='table'`).all().map(r => r.name)
const skipFromWorld = new Set(['player_players', 'player_items', 'player_known_recipes', '_migrations'])
const reserved     = new Set(['sqlite_sequence'])
const worldTables = allSrcTables.filter(t => !skipFromWorld.has(t) && !reserved.has(t))
console.log(`[3/5] copying ${worldTables.length} non-player tables into world DB`)
for (const t of worldTables) {
  const stmt = world.prepare(`select sql from src.sqlite_master where type='table' and name=?`).get(t)
  if (!stmt?.sql) continue
  const stmtIdx = world.prepare(`select sql from src.sqlite_master where type='index' and tbl_name=?`).all(t)
  world.exec(stmt.sql)
  for (const idx of stmtIdx) if (idx.sql) world.exec(idx.sql)
  const cols = world.prepare(`pragma src.table_info(${t})`).all().map(c => c.name)
  const placeholders = cols.map(() => '?').join(', ')
  const rows = world.prepare(`select * from src.${t}`).all()
  if (rows.length === 0) continue
  const ins = world.prepare(`insert into ${t} (${cols.join(', ')}) values (${placeholders})`)
  const tx = world.transaction((rs) => { for (const r of rs) ins.run(...cols.map(c => r[c])) })
  tx(rows)
  console.log(`   ${t}: ${rows.length} rows`)
}

if (countsSrc._migrations > 0) {
  console.log(`[3/5] copying _migrations (${countsSrc._migrations} rows)`)
  world.exec(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL, note TEXT)`)
  const migs = world.prepare(`select * from src._migrations`).all()
  const ins = world.prepare(`insert or ignore into _migrations (version, name, applied_at, note) values (?, ?, ?, ?)`)
  const tx = world.transaction((rs) => { for (const r of rs) ins.run(r.version, r.name, r.applied_at, r.note) })
  tx(migs)
}

world.exec('DETACH DATABASE src')
world.close()

console.log(`[4/5] build players DB at ${playersPath}`)
const players = new Database(playersPath)
players.pragma('foreign_keys = ON')
players.exec(`ATTACH DATABASE '${srcPath.replace(/'/g, "''")}' AS src`)
players.exec(`
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

console.log(`[4/5] extracting player_* rows from src`)
let copiedP = 0, copiedI = 0, copiedK = 0
if (countsSrc.player_players > 0) {
  const rows = players.prepare(`select id, region_id, account_id, permission, name, password_hash, salt, room_id, data from src.player_players`).all()
  const ins = players.prepare(`insert or ignore into player_players (id, region_id, account_id, permission, name, password_hash, salt, room_id, data) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const tx = players.transaction((rs) => { for (const r of rs) ins.run(r.id, r.region_id, r.account_id, r.permission, r.name, r.password_hash, r.salt, r.room_id, r.data) })
  tx(rows); copiedP = rows.length
}
if (countsSrc.player_items > 0) {
  const rows = players.prepare(`select id, owner_id, template_id, item_state from src.player_items`).all()
  const ins = players.prepare(`insert or ignore into player_items (id, owner_id, template_id, item_state) values (?, ?, ?, ?)`)
  const tx = players.transaction((rs) => { for (const r of rs) ins.run(r.id, r.owner_id, r.template_id, r.item_state) })
  tx(rows); copiedI = rows.length
}
if (countsSrc.player_known_recipes > 0) {
  const rows = players.prepare(`select uid, world_id, recipe_id, learned_at from src.player_known_recipes`).all()
  const ins = players.prepare(`insert or ignore into player_known_recipes (uid, world_id, recipe_id, learned_at) values (?, ?, ?, ?)`)
  const tx = players.transaction((rs) => { for (const r of rs) ins.run(r.uid, r.world_id, r.recipe_id, r.learned_at) })
  tx(rows); copiedK = rows.length
}
console.log(`[4/5] copied player_players=${copiedP} player_items=${copiedI} player_known_recipes=${copiedK}`)

players.exec('DETACH DATABASE src')
players.close()

src.close()

let renamedOriginal = false
const singlefileBak = `${srcPath}.singlefile.${ts}.bak`
try {
  console.log(`[5/5] archiving original src to ${singlefileBak}`)
  renameSync(srcPath, singlefileBak)
  renamedOriginal = true
} catch (e) {
  console.warn(`[5/5] could not rename original src (held open): ${e.code}`)
  console.warn(`       leaving ${srcPath} in place. It will be ignored as long as the server`)
  console.warn(`       is launched with MUD_DB_PATH pointing at mud.world.db.`)
}

console.log('')
console.log('=== split complete ===')
console.log(`world DB   : ${worldPath}`)
console.log(`players DB : ${playersPath}`)
console.log(`presplit backup : ${backupPath}`)
console.log(`original archive: ${renamedOriginal ? singlefileBak : '(still in place, ignored by server)'}`)
console.log('')
console.log('Next: launch server with:')
console.log(`  MUD_DB_PATH=${worldPath} ./ModularMudServer`)
console.log('(players DB is auto-derived at <dir>/mud.players.db)')
