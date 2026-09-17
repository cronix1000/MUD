import Database from 'better-sqlite3'
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDb } from './db'

export interface Migration {
  version: number
  name: string
  sql: string[]
}

export interface MigrationRecord {
  version: number
  name: string
  applied_at: number
  note: string | null
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'add_dialogue_root_to_world_mobs',
    sql: ['ALTER TABLE world_mobs ADD COLUMN dialogue_root TEXT;'],
  },
  {
    version: 2,
    name: 'create_world_quests',
    sql: [
      `CREATE TABLE IF NOT EXISTS world_quests (
        world_id TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        script_ref TEXT,
        PRIMARY KEY (world_id, quest_id)
      );`,
    ],
  },
  {
    version: 3,
    name: 'create_world_quest_objectives',
    sql: [
      `CREATE TABLE IF NOT EXISTS world_quest_objectives (
        world_id TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        kind TEXT NOT NULL,
        target TEXT,
        count INTEGER DEFAULT 1,
        PRIMARY KEY (world_id, quest_id, ordinal)
      );`,
    ],
  },
  {
    version: 4,
    name: 'create_world_quest_rewards',
    sql: [
      `CREATE TABLE IF NOT EXISTS world_quest_rewards (
        world_id TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        kind TEXT NOT NULL,
        payload_json TEXT,
        PRIMARY KEY (world_id, quest_id, ordinal)
      );`,
    ],
  },
  {
    version: 5,
    name: 'add_symbol_width_to_world_worlds',
    sql: ['ALTER TABLE world_worlds ADD COLUMN symbol_width INTEGER DEFAULT 1;'],
  },
  {
    version: 6,
    name: 'migrate_floor_settings_overrides',
    sql: [
      "ALTER TABLE world_regions ADD COLUMN floor_settings_deprecated_at INTEGER;",
    ],
  },
  {
    version: 7,
    name: 'create_migrations_table_marker',
    sql: [
      `CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        note TEXT
      );`,
    ],
  },
  {
    version: 8,
    name: 'add_pattern_to_world_terrains',
    sql: [
      "ALTER TABLE world_terrains ADD COLUMN pattern TEXT DEFAULT 'none';",
    ],
  },
  {
    version: 9,
    name: 'auto_assign_patterns_to_default_tiles',
    sql: [
      "UPDATE world_terrains SET pattern = 'hatch'   WHERE symbol = 'x';",
      "UPDATE world_terrains SET pattern = 'dots'    WHERE symbol = '~';",
      "UPDATE world_terrains SET pattern = 'stripes' WHERE symbol = 'T';",
      "UPDATE world_terrains SET pattern = 'none'    WHERE symbol = '.';",
    ],
  },
  {
    version: 10,
    name: 'drop_pattern_column_from_world_terrains',
    sql: [
      'ALTER TABLE world_terrains DROP COLUMN pattern;',
    ],
  },
  {
    version: 11,
    name: 'add_region_metadata',
    sql: [
      "ALTER TABLE world_regions ADD COLUMN region_kind TEXT DEFAULT 'static';",
      'ALTER TABLE world_regions ADD COLUMN generator_script TEXT;',
      'ALTER TABLE world_regions ADD COLUMN template_config_json TEXT;',
      'ALTER TABLE world_regions ADD COLUMN tutorial_steps_json TEXT;',
    ],
  },
  {
    version: 12,
    name: 'create_world_recipes',
    sql: [
      `CREATE TABLE IF NOT EXISTS world_recipes (
        world_id TEXT NOT NULL,
        recipe_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        skill_id TEXT,
        required_skill_level INTEGER DEFAULT 0,
        station_type TEXT,
        outputs_json TEXT,
        inputs_json TEXT,
        craft_time_seconds REAL DEFAULT 3.0,
        experience_gain INTEGER DEFAULT 0,
        script_ref TEXT,
        is_auto_learned INTEGER DEFAULT 1,
        PRIMARY KEY (world_id, recipe_id)
      );`,
    ],
  },
  {
    version: 13,
    name: 'create_player_known_recipes',
    sql: [
      `CREATE TABLE IF NOT EXISTS players.player_known_recipes (
        uid INTEGER NOT NULL,
        world_id TEXT NOT NULL,
        recipe_id TEXT NOT NULL,
        learned_at INTEGER NOT NULL,
        PRIMARY KEY (uid, world_id, recipe_id)
      );`,
    ],
  },
  {
    version: 14,
    name: 'add_xp_curve_to_world_skills',
    sql: [
      "ALTER TABLE world_skills ADD COLUMN xp_curve TEXT DEFAULT 'linear';",
      'ALTER TABLE world_skills ADD COLUMN xp_curve_params TEXT;',
    ],
  },
  {
    version: 15,
    name: 'add_station_type_to_world_interactables',
    sql: [
      'ALTER TABLE world_interactables ADD COLUMN station_type TEXT;',
    ],
  },
]

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL,
    note TEXT
  );`)
}

export function getAppliedMigrations(): MigrationRecord[] {
  const db = getDb()
  ensureMigrationsTable(db)
  return db
    .prepare(`select version, name, applied_at, note from _migrations order by version asc`)
    .all() as MigrationRecord[]
}

export function getPendingMigrations(): Migration[] {
  const applied = new Set(getAppliedMigrations().map((m) => m.version))
  return MIGRATIONS.filter((m) => !applied.has(m.version)).sort(
    (a, b) => a.version - b.version,
  )
}

function getDbPath(): string {
  const configured = process.env.MUD_DB_PATH
  const candidates = [
    configured,
    resolve(process.cwd(), '..', 'ModularMudServer', 'mud.db'),
    resolve(process.cwd(), 'ModularMudServer', 'mud.db'),
  ].filter(Boolean) as string[]
  const found = candidates.find((p) => existsSync(p))
  if (!found) {
    throw new Error(`mud.db not found. Tried:\n${candidates.join('\n')}`)
  }
  return found
}

function backupDatabase(): string {
  const src = getDbPath()
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = `${src}.bak.${ts}`
  copyFileSync(src, dest)
  return dest
}

function getDbBaseName(): string {
  const full = getDbPath()
  return full.split(/[\\/]/).pop() ?? 'mud.db'
}

export interface RunResult {
  backup: string | null
  results: Array<{
    version: number
    name: string
    ok: boolean
    error?: string
  }>
}

export function runPendingMigrations(options: { backup: boolean; skipVersions?: number[] }): RunResult {
  ensureMigrationsTable(getDb())
  const applied = new Set(getAppliedMigrations().map((m) => m.version))
  const skip = new Set(options.skipVersions ?? [])
  const pending = MIGRATIONS
    .filter((m) => !applied.has(m.version) && !skip.has(m.version))
    .sort((a, b) => a.version - b.version)

  if (pending.length === 0) {
    return { backup: null, results: [] }
  }

  const backup = options.backup ? backupDatabase() : null

  const db = getDb()
  const insertMigration = db.prepare(
    `insert into _migrations (version, name, applied_at, note) values (?, ?, ?, ?)`,
  )

  const results: RunResult['results'] = []

  for (const m of pending) {
    try {
      db.transaction(() => {
        for (const stmt of m.sql) {
          db.exec(stmt)
        }
        insertMigration.run(m.version, m.name, Date.now(), null)
      })()
      results.push({ version: m.version, name: m.name, ok: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({ version: m.version, name: m.name, ok: false, error: msg })
      break
    }
  }

  return { backup, results }
}

export function listBackups(): Array<{ path: string; mtime: number; size: number }> {
  const dbPath = getDbPath()
  const dir = resolve(dbPath, '..')
  const base = getDbBaseName()
  return readdirSync(dir)
    .filter((f) => f.startsWith(`${base}.bak.`))
    .map((f) => {
      const full = resolve(dir, f)
      const st = statSync(full)
      return { path: full, mtime: st.mtimeMs, size: st.size }
    })
    .sort((a, b) => b.mtime - a.mtime)
}
