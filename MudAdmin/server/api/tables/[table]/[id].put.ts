import { assertTable, updateRow, getRow } from '../../../utils/db'
import { decodeCompositeKey, isCompositeKey } from '../../../utils/composite-key'

export default defineEventHandler(async (event) => {
  const table = getRouterParam(event, 'table')!
  const rawId = getRouterParam(event, 'id')!
  assertTable(table)
  const id = isCompositeKey(table) ? decodeCompositeKey(table, rawId) : rawId
  const body = await readBody<Record<string, unknown>>(event)
  const result = updateRow(table, id, body ?? {})
  return { ...result, row: getRow(table, id) }
})
