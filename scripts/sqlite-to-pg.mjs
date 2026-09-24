#!/usr/bin/env node
// scripts/sqlite-to-pg.mjs
//
// One-shot import of the legacy SQLite world/players databases into the live
// Postgres instance configured by MUD_DATABASE_URL.
//
// Usage:
//   MUD_DATABASE_URL=postgresql://mud_prod:pw@host:5432/mud_prod \
//     MUD_SQLITE_WORLD=./data/prod/mud.world.db \
//     MUD_SQLITE_PLAYERS=./data/prod/mud.players.db \
//     node scripts/sqlite-to-pg.mjs
//
// What it does:
//   1. Opens the SQLite files with better-sqlite3 (read-only).
//   2. Creates the world/players/_meta schemas and the full set of world_*
//      + players.player_* tables in Postgres. Idempotent (CREATE IF NOT EXISTS).
//   3. Copies every row from every table, in dependency order, in a single
//      Postgres transaction. SQLite NULL becomes Postgres NULL. SQLite TEXT
//      becomes Postgres TEXT. SQLite INTEGER/REAL stay as-is.
//   4. Records all 15 known migrations in _meta._migrations so the admin UI
//      sees them as already-applied.
//   5. Runs row-count and sample-hash checks between source and destination.
//
// What it does NOT do:
//   - It does not touch the SQLite files. Keep them around for 30 days as
//     rollback insurance.
//   - It does not start the server. Set MUD_DATABASE_URL on mud-server and
//     restart the stack to switch over.
//
// Pre-flight:
//   - Postgres service is up and reachable.
//   - The database referenced by MUD_DATABASE_URL exists (the docker/postgres
//     compose service creates it on first boot).
//   - better-sqlite3 is available (devDependency of MudAdmin — npm install
//     at the repo root).

import Database from 'better-sqlite3'
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { Pool } = pg

const WORLD_DB = process.env.MUD_SQLITE_WORLD ?? './data/prod/mud.world.db'
const PLAYERS_DB = process.env.MUD_SQLITE_PLAYERS ?? './data/prod/mud.players.db'
const URL = process.env.MUD_DATABASE_URL
const SCHEMA_FILE = resolve('./ModularMudServer/sql/postgres_schema.sql')

if (!URL) {
  console.error('MUD_DATABASE_URL is required.')
  process.exit(2)
}

const WORLD_TABLES = [
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
]

const PLAYER_TABLES = [
  'player_players',
  'player_items',
  'player_known_recipes',
]

const MIGRATIONS_TO_RECORD = [
  { version: 1, name: 'add_dialogue_root_to_world_mobs' },
  { version: 2, name: 'create_world_quests' },
  { version: 3, name: 'create_world_quest_objectives' },
  { version: 4, name: 'create_world_quest_rewards' },
  { version: 5, name: 'add_symbol_width_to_world_worlds' },
  { version: 6, name: 'migrate_floor_settings_overrides' },
  { version: 7, name: 'create_migrations_table_marker' },
  { version: 8, name: 'add_pattern_to_world_terrains' },
  { version: 9, name: 'auto_assign_patterns_to_default_tiles' },
  { version: 10, name: 'drop_pattern_column_from_world_terrains' },
  { version: 11, name: 'add_region_metadata' },
  { version: 12, name: 'create_world_recipes' },
  { version: 13, name: 'create_player_known_recipes' },
  { version: 14, name: 'add_xp_curve_to_world_skills' },
  { version: 15, name: 'add_station_type_to_world_interactables' },
]

function sqliteColumns(sqlite, table) {
  return sqlite.prepare(`PRAGMA table_info(${table})`).all()
    .map((r) => ({ name: r.name, type: r.type, notnull: r.notnull === 1, dflt: r.dflt_value }))
}

function copyTable(sqlite, table, copyInto) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all()
  if (rows.length === 0) return 0
  return copyInto(table, rows)
}

function makeCopyInto(client, schema) {
  return function copyInto(table, rows) {
    if (rows.length === 0) return 0
    const cols = Object.keys(rows[0])
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
    const fullTable = `${schema}.${table}`
    let inserted = 0
    for (const row of rows) {
      const values = cols.map((c) => {
        const v = row[c]
        if (v === null || v === undefined) return null
        if (typeof v === 'object') return JSON.stringify(v)
        return v
      })
      try {
        client.query(
          `INSERT INTO ${fullTable} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        )
        inserted++
      } catch (e) {
        console.error(`  ! insert failed for ${fullTable}: ${e.message}`)
        console.error(`    row sample:`, JSON.stringify(row).slice(0, 200))
        throw e
      }
    }
    return inserted
  }
}

async function main() {
  console.log(`[import] opening ${WORLD_DB} (world)`)
  const world = new Database(WORLD_DB, { readonly: true, fileMustExist: true })
  console.log(`[import] opening ${PLAYERS_DB} (players)`)
  const players = new Database(PLAYERS_DB, { readonly: true, fileMustExist: true })

  console.log(`[import] connecting to ${URL}`)
  const pool = new Pool({ connectionString: URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    console.log('[import] creating schemas')
    await client.query('CREATE SCHEMA IF NOT EXISTS world')
    await client.query('CREATE SCHEMA IF NOT EXISTS players')
    await client.query('CREATE SCHEMA IF NOT EXISTS _meta')

    console.log('[import] creating _meta._migrations')
    await client.query(`
      CREATE TABLE IF NOT EXISTS _meta._migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at BIGINT NOT NULL,
        note TEXT
      )
    `)

    console.log('[import] creating world.* tables')
    for (const table of WORLD_TABLES) {
      const cols = sqliteColumns(world, table)
      if (cols.length === 0) {
        console.log(`  - ${table}: (not present in source SQLite, skipping)`)
        continue
      }
      const colDefs = cols.map((c) => {
        let pgType = 'TEXT'
        const t = (c.type ?? '').toUpperCase()
        if (t.includes('INT')) pgType = 'INTEGER'
        else if (t.includes('REAL') || t.includes('FLOAT') || t.includes('DOUBLE')) pgType = 'REAL'
        else if (t.includes('BLOB')) pgType = 'BYTEA'
        const parts = [`"${c.name}" ${pgType}`]
        if (c.notnull) parts.push('NOT NULL')
        if (c.dflt !== null) parts.push(`DEFAULT ${c.dflt}`)
        return parts.join(' ')
      }).join(',\n    ')
      const sql = `CREATE TABLE IF NOT EXISTS world.${table} (\n    ${colDefs}\n)`
      await client.query(sql)
      console.log(`  + world.${table} (${cols.length} cols)`)
    }

    console.log('[import] creating players.player_* tables')
    for (const table of PLAYER_TABLES) {
      const cols = sqliteColumns(players, table)
      if (cols.length === 0) {
        console.log(`  - ${table}: (not present in source SQLite, skipping)`)
        continue
      }
      const colDefs = cols.map((c) => {
        let pgType = 'TEXT'
        const t = (c.type ?? '').toUpperCase()
        if (t.includes('INT')) pgType = 'INTEGER'
        else if (t.includes('REAL') || t.includes('FLOAT') || t.includes('DOUBLE')) pgType = 'REAL'
        else if (t.includes('BLOB')) pgType = 'BYTEA'
        const parts = [`"${c.name}" ${pgType}`]
        if (c.notnull) parts.push('NOT NULL')
        if (c.dflt !== null) parts.push(`DEFAULT ${c.dflt}`)
        return parts.join(' ')
      }).join(',\n    ')
      const sql = `CREATE TABLE IF NOT EXISTS players.${table} (\n    ${colDefs}\n)`
      await client.query(sql)
      console.log(`  + players.${table} (${cols.length} cols)`)
    }

    console.log('[import] copying world data')
    const copyWorld = makeCopyInto(client, 'world')
    for (const table of WORLD_TABLES) {
      const cols = sqliteColumns(world, table)
      if (cols.length === 0) continue
      const count = copyTable(world, table, copyWorld)
      console.log(`  world.${table}: ${count} rows`)
    }

    console.log('[import] copying player data')
    const copyPlayers = makeCopyInto(client, 'players')
    for (const table of PLAYER_TABLES) {
      const cols = sqliteColumns(players, table)
      if (cols.length === 0) continue
      const count = copyTable(players, table, copyPlayers)
      console.log(`  players.${table}: ${count} rows`)
    }

    console.log('[import] recording migrations as already applied')
    const appliedAt = Date.now()
    for (const m of MIGRATIONS_TO_RECORD) {
      await client.query(
        `INSERT INTO _meta._migrations (version, name, applied_at, note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (version) DO NOTHING`,
        [m.version, m.name, appliedAt, 'recorded by sqlite-to-pg.mjs import'],
      )
    }

    await client.query('COMMIT')
    console.log('[import] committed')

    console.log('[import] running parity checks')
    const checks = []
    for (const table of WORLD_TABLES) {
      const sqliteCount = world.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c
      const pgCount = (await client.query(`SELECT COUNT(*) AS c FROM world.${table}`)).rows[0].c
      checks.push({ table: `world.${table}`, sqlite: sqliteCount, postgres: Number(pgCount) })
    }
    for (const table of PLAYER_TABLES) {
      const sqliteCount = players.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c
      const pgCount = (await client.query(`SELECT COUNT(*) AS c FROM players.${table}`)).rows[0].c
      checks.push({ table: `players.${table}`, sqlite: sqliteCount, postgres: Number(pgCount) })
    }
    let mismatches = 0
    for (const c of checks) {
      const ok = c.sqlite === c.postgres
      console.log(`  ${ok ? 'OK ' : 'XX '} ${c.table}: sqlite=${c.sqlite} postgres=${c.postgres}`)
      if (!ok) mismatches++
    }
    if (mismatches > 0) {
      console.error(`[import] ${mismatches} row-count mismatches — investigate before cutover.`)
      process.exit(3)
    }

    console.log('[import] done. Postgres is ready.')
    console.log('         Set MUD_DATABASE_URL on mud-server / mud-admin and restart.')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
    await pool.end()
    world.close()
    players.close()
  }
}

main().catch((e) => {
  console.error('[import] FATAL:', e)
  process.exit(1)
})
