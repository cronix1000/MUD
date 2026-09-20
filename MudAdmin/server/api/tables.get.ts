import { getPool } from '../utils/db'

export default defineEventHandler(async () => {
  const res = await getPool().query<{ table_name: string }>(
    `select table_name
       from information_schema.tables
      where table_schema = any (array['world','players','_meta'])
        and (table_name like 'player_%' or table_name like 'world_%' or table_name like '_migrations')
      order by table_name`,
  )
  return { tables: res.rows.map((r) => r.table_name) }
})
