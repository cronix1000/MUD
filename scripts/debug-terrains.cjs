const { Client } = require('pg')
const url = process.env.MUD_DATABASE_URL || 'postgresql://mud_beta:super_mud_pass_1@127.0.0.1:5432/mud_beta'
const client = new Client({ connectionString: url })
;(async () => {
  await client.connect()
  const cols = await client.query(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'world' and table_name = 'world_terrains' order by ordinal_position`)
  console.log('world_terrains columns:')
  for (const c of cols.rows) console.log(' ', c.column_name, c.data_type, c.is_nullable, c.column_default)
  const pk = await client.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = 'world.world_terrains'::regclass and i.indisprimary`)
  console.log('PK columns:', pk.rows.map((r) => r.attname))
  try {
    const r = await client.query(`insert into world.world_terrains (world_id, symbol, name, color, blocks_move, blocks_sight, move_cost) values ('default', 'X', 'Test', '&Y', 0, 0, 1) returning symbol`)
    console.log('insert OK:', r.rows)
  } catch (e) {
    console.log('insert FAILED:', e.message)
  }
  await client.end()
})().catch((e) => { console.error(e); process.exit(1) })