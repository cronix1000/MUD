import { assertTable, insertRow } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const table = getRouterParam(event, 'table')!
  assertTable(table)
  const body = await readBody<Record<string, unknown>>(event)
  return insertRow(table, body ?? {})
})
