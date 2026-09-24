import { assertTable, getColumns, listRows } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const table = getRouterParam(event, 'table')!
  assertTable(table)
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit ?? 100) || 100, 500)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)
  const q = String(query.q ?? '').trim()
  const cols = await getColumns(table)
  let rows = await listRows(table, limit, offset)
  if (q) {
    const ql = q.toLowerCase()
    rows = (rows as Array<Record<string, unknown>>).filter((row) => {
      for (const c of cols) {
        const v = row[c.name]
        if (v === null || v === undefined) continue
        if (typeof v === 'object') {
          if (JSON.stringify(v).toLowerCase().includes(ql)) return true
        } else if (String(v).toLowerCase().includes(ql)) {
          return true
        }
      }
      return false
    })
  }
  return { table, columns: cols, rows, limit, offset }
})
