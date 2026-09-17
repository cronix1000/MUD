import { getDb } from '../utils/db'

export default defineEventHandler(() => {
  const rows = getDb()
    .prepare("select name from sqlite_master where type='table' and (name like 'player_%' or name like 'world_%') order by name")
    .all() as { name: string }[]
  return { tables: rows.map((r) => r.name) }
})
