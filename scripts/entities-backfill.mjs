#!/usr/bin/env node
// scripts/entities-backfill.mjs
//
// One-shot (but idempotent) backfill of the legacy world_* row tables into
// world.entities documents, plus the player_players.data + player_items fold
// into players.player_players.state.
//
// Doc shapes mirror the loader outputs in ModularMudServer/PostgresDatabase.cpp
// (RowToJson semantics + per-loader reshaping), so the C++ factories can
// consume the documents unchanged via MUD_WORLD_SOURCE=entities.
//
// Usage:
//   MUD_DATABASE_URL=postgresql://mud_prod:pw@127.0.0.1:5432/mud_prod \
//     node scripts/entities-backfill.mjs            # dry run (prints counts + samples)
//     node scripts/entities-backfill.mjs --apply    # write
//
// Re-running with --apply is safe: entity docs are upserted (parent_id is
// preserved on conflict), and player state is only written when still empty.

import pg from 'pg'

const { Pool } = pg
const URL = process.env.MUD_DATABASE_URL
const APPLY = process.argv.includes('--apply')

if (!URL) {
  console.error('MUD_DATABASE_URL is required.')
  process.exit(2)
}

const pool = new Pool({ connectionString: URL })

// Mirrors PostgresDatabase::RowToJson: jsonCols that hold objects are merged
// into the parent; arrays are stored under the column name with the "_json"
// suffix stripped; nulls and skipped columns are omitted.
function rowToJson(row, skip = [], jsonCols = []) {
  const out = {}
  for (const [name, raw] of Object.entries(row)) {
    if (skip.includes(name)) continue
    if (raw === null || raw === undefined) continue
    if (jsonCols.includes(name)) {
      let parsed = raw
      if (typeof raw === 'string') {
        if (raw.trim() === '') continue
        try { parsed = JSON.parse(raw) } catch { out[name] = raw; continue }
      }
      if (Array.isArray(parsed)) out[name.replace(/_json$/, '')] = parsed
      else if (parsed && typeof parsed === 'object') Object.assign(out, parsed)
      else out[name] = parsed
      continue
    }
    out[name] = raw
  }
  return out
}

function parseJson(raw, fallback) {
  if (raw === null || raw === undefined) return fallback
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string' && raw.trim() === '') return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function truthy(v) {
  return v === true || v === 'true' || v === 't' || v === 1 || v === '1'
}

const stats = { types: {}, players: 0, errors: [] }
let goldenPrinted = 0

async function tolerant(label, fn) {
  try {
    await fn()
  } catch (e) {
    if (e.code === '42P01') {
      stats.errors.push(`${label}: source table missing, skipped`)
      return
    }
    throw e
  }
}

async function all(sql, params = []) {
  const r = await pool.query(sql, params)
  return r.rows
}

async function upsertEntity(entityType, entityId, doc) {
  if (!entityId) {
    stats.errors.push(`${entityType}: row with empty id skipped`)
    return
  }
  stats.types[entityType] = (stats.types[entityType] ?? 0) + 1
  if (goldenPrinted < 14 && !APPLY) {
    console.log(`  sample ${entityType}/${entityId}: ${JSON.stringify(doc).slice(0, 220)}`)
    goldenPrinted++
  }
  if (!APPLY) return
  await pool.query(
    `INSERT INTO world.entities (entity_type, entity_id, doc, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (entity_type, entity_id) DO UPDATE
       SET doc = EXCLUDED.doc, updated_at = now()`,
    [entityType, entityId, JSON.stringify(doc)],
  )
}

// ---------------------------------------------------------------------------
// Entity-type backfills
// ---------------------------------------------------------------------------

async function backfillItems() {
  const rows = await all('SELECT * FROM world.world_items')
  for (const r of rows) {
    const obj = rowToJson(r, ['template_id', 'meta'], ['components_json'])
    obj.equippable = truthy(r.equippable)
    if (r.script_ref) obj.script = r.script_ref
    const components = {}
    for (const k of ['weapon', 'armour', 'scripts', 'passive_skills', 'armor', 'messages']) {
      if (k in obj) { components[k] = obj[k]; delete obj[k] }
    }
    if (r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta)) obj.meta = r.meta
    if (Object.keys(components).length) obj.components = components
    await upsertEntity('item', r.template_id, obj)
  }
}

async function backfillMobs() {
  const rows = await all('SELECT * FROM world.world_mobs')
  for (const r of rows) {
    const obj = rowToJson(r, ['template_id', 'meta', 'crit_chance', 'crit_mult'], ['attack_patterns_json', 'extra_json'])
    if (r.crit_chance !== null && r.crit_chance !== undefined) obj.critical_chance = Number(r.crit_chance)
    if (r.crit_mult !== null && r.crit_mult !== undefined) obj.critical_multiplier = Number(r.crit_mult)
    if (r.script_ref) obj.script = r.script_ref
    const stat = {}
    for (const k of ['strength', 'dexterity', 'intelligence']) {
      if (k in obj) { stat[k] = obj[k]; delete obj[k] }
    }
    obj.stat = stat
    if (r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta)) obj.meta = r.meta
    await upsertEntity('mob', r.template_id, obj)
  }
}

async function backfillInteractables() {
  const rows = await all('SELECT * FROM world.world_interactables')
  for (const r of rows) {
    const obj = rowToJson(r, ['template_id'], ['components_json'])
    if (r.script_ref) obj.script = r.script_ref
    const components = {}
    for (const k of ['portal', 'chest', 'door', 'lever', 'healing', 'inventory', 'loot', 'messages', 'meta', 'crafting']) {
      if (k in obj) { components[k] = obj[k]; delete obj[k] }
    }
    if (Object.keys(components).length) obj.components = components
    await upsertEntity('interactable', r.template_id, obj)
  }
}

async function backfillSkills() {
  const cats = await all('SELECT * FROM world.world_skill_categories')
  for (const r of cats) {
    const obj = rowToJson(r, ['category_id'], ['stats_json'])
    if ('synergy_bonus' in obj) { obj.synergyBonus = obj.synergy_bonus; delete obj.synergy_bonus }
    await upsertEntity('skill_category', r.category_id, obj)
  }
  const sks = await all('SELECT * FROM world.world_skills')
  for (const r of sks) {
    const obj = rowToJson(r, ['skill_id'], ['costs_json'])
    if (r.script_ref) obj.script = r.script_ref
    await upsertEntity('skill', r.skill_id, obj)
  }
}

async function backfillLootTables() {
  const rows = await all('SELECT * FROM world.world_loot_tables')
  for (const r of rows) {
    const doc = { name: r.name, entries: parseJson(r.entries_json, []) }
    await upsertEntity('loot_table', r.table_id, doc)
  }
}

async function backfillDialogues() {
  const rows = await all('SELECT * FROM world.world_dialogues')
  for (const r of rows) {
    let doc
    if (r.text !== null && r.text !== undefined) {
      const options = parseJson(r.options_json, null)
      doc = { text: r.text, options: Array.isArray(options) ? options : [] }
    } else {
      doc = {}
      for (const k of ['idle_json', 'combat_json', 'death_json']) {
        const v = parseJson(r[k], null)
        if (v !== null) doc[k.replace('_json', '')] = v
      }
    }
    await upsertEntity('dialogue', r.node_id, doc)
  }
}

async function backfillRecipes() {
  const rows = await all('SELECT * FROM world.world_recipes')
  for (const r of rows) {
    const obj = rowToJson(r, ['recipe_id'], ['outputs_json', 'inputs_json'])
    await upsertEntity('recipe', r.recipe_id, obj)
  }
}

async function backfillFactions() {
  const relations = await all('SELECT * FROM world.world_faction_relations')
  const byFaction = {}
  for (const rel of relations) {
    byFaction[rel.faction_id] = byFaction[rel.faction_id] ?? {}
    byFaction[rel.faction_id][rel.other_faction_id] = rel.base_standing
  }
  const rows = await all('SELECT * FROM world.world_factions')
  for (const r of rows) {
    const doc = rowToJson(r, ['faction_id'])
    if (byFaction[r.faction_id]) doc.relations = byFaction[r.faction_id]
    await upsertEntity('faction', r.faction_id, doc)
  }
}

async function backfillClassesRaces() {
  const classes = await all('SELECT * FROM world.world_classes')
  for (const r of classes) await upsertEntity('class', r.class_id, rowToJson(r, ['class_id']))
  const races = await all('SELECT * FROM world.world_races')
  for (const r of races) await upsertEntity('race', r.race_id, rowToJson(r, ['race_id']))
}

async function backfillShops() {
  const keepers = await all('SELECT * FROM world.world_shop_keeper')
  const docs = {}
  for (const r of keepers) {
    docs[r.keeper_id] = rowToJson(r, ['keeper_id'])
    docs[r.keeper_id].markup = Number(r.markup)
    docs[r.keeper_id].markdown = Number(r.markdown)
    docs[r.keeper_id].inventory = {}
  }
  const inv = await all('SELECT * FROM world.world_shop_inventory')
  for (const r of inv) {
    if (docs[r.keeper_id]) {
      docs[r.keeper_id].inventory[r.template_id] = rowToJson(r, ['keeper_id', 'template_id'])
    }
  }
  for (const [id, doc] of Object.entries(docs)) await upsertEntity('shop', id, doc)
}

async function backfillBoards() {
  const rows = await all('SELECT * FROM world.world_board')
  for (const r of rows) await upsertEntity('board', r.board_id, rowToJson(r, ['board_id']))
}

async function backfillTerrains() {
  const rows = await all('SELECT * FROM world.world_terrains')
  for (const r of rows) {
    if (!r.symbol) continue
    await upsertEntity('terrain', r.symbol, {
      symbol: r.symbol,
      name: r.name ?? 'Unknown',
      color: r.color ?? 'white',
      blocks_move: truthy(r.blocks_move),
      blocks_sight: truthy(r.blocks_sight),
      move_cost: r.move_cost ?? 1,
    })
  }
}

async function backfillRegions() {
  const overrides = await all('SELECT * FROM world.world_region_overrides ORDER BY id')
  const byRegion = {}
  for (const o of overrides) {
    byRegion[o.region_id] = byRegion[o.region_id] ?? []
    byRegion[o.region_id].push({
      target_type: o.target_type,
      target_id: o.target_id,
      override: parseJson(o.override_json, {}),
    })
  }
  const rows = await all('SELECT * FROM world.world_regions')
  for (const r of rows) {
    const doc = rowToJson(r, ['id', 'floor_settings_json', 'floor_palette_json'])
    doc.floor_settings = parseJson(r.floor_settings_json, {})
    doc.floor_palette = parseJson(r.floor_palette_json, [])
    if (byRegion[r.id]?.length) doc.overrides = byRegion[r.id]
    await upsertEntity('region', r.id, doc)
  }
}

async function backfillZones() {
  const rows = await all('SELECT * FROM world.world_zones')
  for (const r of rows) {
    const doc = rowToJson(r, ['region_id', 'zone_id', 'created_at'], ['rules_json'])
    doc.region_id = r.region_id
    doc.zone_id = r.zone_id
    doc.is_active = r.is_active === true || r.is_active === 'true'
    await upsertEntity('zone', `${r.region_id}::${r.zone_id}`, doc)
  }
}

async function backfillRooms() {
  const rooms = await all('SELECT * FROM world.world_rooms ORDER BY region_id, room_id')
  const exitRows = await all('SELECT * FROM world.world_room_exits ORDER BY region_id, from_room_id, direction')
  const spawnRows = await all('SELECT * FROM world.world_room_spawns ORDER BY region_id, room_id, x, y')
  const exitsByRoom = {}
  for (const e of exitRows) {
    const key = `${e.region_id}::${e.from_room_id}`
    exitsByRoom[key] = exitsByRoom[key] ?? {}
    const exit = {
      target_room: e.to_room_id,
      dest_x: e.dest_x ?? -1,
      dest_y: e.dest_y ?? -1,
      is_one_way: truthy(e.is_one_way),
      is_portal: truthy(e.is_portal),
      auto_trigger: truthy(e.auto_trigger),
    }
    if (e.portal_name) exit.portal_name = e.portal_name
    exitsByRoom[key][e.direction] = exit
  }
  const spawnsByRoom = {}
  for (const s of spawnRows) {
    const key = `${s.region_id}::${s.room_id}`
    spawnsByRoom[key] = spawnsByRoom[key] ?? []
    spawnsByRoom[key].push({
      x: s.x,
      y: s.y,
      type: s.type ?? '',
      template_id: s.template_id ?? '',
      respawn_time: Number(s.respawn_time ?? 30),
      is_respawning: truthy(s.is_respawning),
      override: parseJson(s.override_json, {}),
    })
  }
  for (const r of rooms) {
    const key = `${r.region_id}::${r.room_id}`
    const doc = rowToJson(r, ['region_id', 'room_id', 'layout_json', 'scripts_json', 'extra_json', 'meta', 'zone_id'], [])
    doc.region_id = r.region_id
    doc.room_id = r.room_id
    doc.layout = parseJson(r.layout_json, [])
    if (r.scripts_json) doc.scripts = parseJson(r.scripts_json, null)
    const extra = parseJson(r.extra_json, null)
    if (extra && typeof extra === 'object' && !Array.isArray(extra) && 'rules' in extra) doc.rules = extra.rules
    if (r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta)) doc.meta = r.meta
    doc.zone_id = r.zone_id ?? 0
    if (exitsByRoom[key] && Object.keys(exitsByRoom[key]).length) doc.exits = exitsByRoom[key]
    if (spawnsByRoom[key]?.length) doc.spawns = spawnsByRoom[key]
    await upsertEntity('room', key, doc)
  }
}

async function backfillQuests() {
  const quests = await all('SELECT * FROM world.world_quests ORDER BY quest_id')
  const objectives = await all('SELECT * FROM world.world_quest_objectives ORDER BY quest_id, ordinal')
  const rewards = await all('SELECT * FROM world.world_quest_rewards ORDER BY quest_id, ordinal')
  const objByQuest = {}
  for (const o of objectives) {
    objByQuest[o.quest_id] = objByQuest[o.quest_id] ?? []
    objByQuest[o.quest_id].push({ kind: o.kind, target: o.target ?? '', count: o.count ?? 1 })
  }
  const rewByQuest = {}
  for (const w of rewards) {
    rewByQuest[w.quest_id] = rewByQuest[w.quest_id] ?? []
    rewByQuest[w.quest_id].push({ kind: w.kind, payload: parseJson(w.payload_json, w.payload_json ?? null) })
  }
  for (const q of quests) {
    const doc = { name: q.name, description: q.description ?? '', script: q.script_ref ?? '' }
    if (objByQuest[q.quest_id]?.length) doc.objectives = objByQuest[q.quest_id]
    if (rewByQuest[q.quest_id]?.length) doc.rewards = rewByQuest[q.quest_id]
    await upsertEntity('quest', q.quest_id, doc)
  }
}

// ---------------------------------------------------------------------------
// Player state fold
// ---------------------------------------------------------------------------

async function backfillPlayers() {
  const players = await all('SELECT id, data FROM players.player_players ORDER BY id')
  for (const p of players) {
    const state = parseJson(p.data, {}) || {}
    const items = await all('SELECT template_id, item_state FROM players.player_items WHERE owner_id = $1', [p.id])
    state.inventory = items.map((i) => ({ template_id: i.template_id, ...parseJson(i.item_state, {}) }))
    stats.players++
    if (!APPLY) {
      if (goldenPrinted < 16) {
        console.log(`  sample player#${p.id} state: ${JSON.stringify(state).slice(0, 220)}`)
        goldenPrinted++
      }
      continue
    }
    await pool.query(
      `UPDATE players.player_players SET state = $1::jsonb WHERE id = $2 AND state = '{}'::jsonb`,
      [JSON.stringify(state), p.id],
    )
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

async function verify() {
  const expectations = {
    item: 'select count(*)::int as c from world.world_items',
    mob: 'select count(*)::int as c from world.world_mobs',
    interactable: 'select count(*)::int as c from world.world_interactables',
    skill: 'select count(*)::int as c from world.world_skills',
    skill_category: 'select count(*)::int as c from world.world_skill_categories',
    loot_table: 'select count(*)::int as c from world.world_loot_tables',
    dialogue: 'select count(*)::int as c from world.world_dialogues',
    recipe: 'select count(*)::int as c from world.world_recipes',
    faction: 'select count(*)::int as c from world.world_factions',
    class: 'select count(*)::int as c from world.world_classes',
    race: 'select count(*)::int as c from world.world_races',
    shop: 'select count(*)::int as c from world.world_shop_keeper',
    board: 'select count(*)::int as c from world.world_board',
    terrain: 'select count(*)::int as c from world.world_terrains where symbol is not null and symbol <> \'\'',
    region: 'select count(*)::int as c from world.world_regions',
    zone: 'select count(*)::int as c from world.world_zones',
    room: 'select count(*)::int as c from world.world_rooms',
    quest: 'select count(*)::int as c from world.world_quests',
  }
  let ok = true
  for (const [type, sql] of Object.entries(expectations)) {
    let expected = 0
    try {
      expected = (await all(sql))[0].c
    } catch {
      console.log(`  --    ${type}: source table missing, skipped`)
      continue
    }
    const r = await all('select count(*)::int as c from world.entities where entity_type = $1', [type])
    const got = r[0].c
    const mark = got === expected ? 'OK ' : 'MISMATCH'
    if (got !== expected) ok = false
    console.log(`  ${mark} ${type}: entities=${got} source=${expected}`)
  }
  return ok
}

;(async () => {
  const c = await pool.connect()
  await c.query('SET search_path TO world, players, _meta, public')
  c.release()

  console.log(APPLY ? 'Applying backfill...' : 'Dry run (use --apply to write)...')

  await tolerant('items', backfillItems)
  await tolerant('mobs', backfillMobs)
  await tolerant('interactables', backfillInteractables)
  await tolerant('skills', backfillSkills)
  await tolerant('loot_tables', backfillLootTables)
  await tolerant('dialogues', backfillDialogues)
  await tolerant('recipes', backfillRecipes)
  await tolerant('factions', backfillFactions)
  await tolerant('classes_races', backfillClassesRaces)
  await tolerant('shops', backfillShops)
  await tolerant('boards', backfillBoards)
  await tolerant('terrains', backfillTerrains)
  await tolerant('regions', backfillRegions)
  await tolerant('zones', backfillZones)
  await tolerant('rooms', backfillRooms)
  await tolerant('quests', backfillQuests)
  await tolerant('players', backfillPlayers)

  console.log('\nBackfilled per type:', stats.types)
  console.log('Players folded:', stats.players)
  if (stats.errors.length) console.log('Errors:', stats.errors)

  if (APPLY) {
    console.log('\nVerification:')
    const ok = await verify()
    console.log(ok ? 'All counts match.' : 'COUNT MISMATCHES PRESENT — inspect before cutover.')
  }

  await pool.end()
  process.exit(0)
})().catch(async (e) => {
  console.error('Backfill failed:', e.message)
  await pool.end().catch(() => {})
  process.exit(1)
})
