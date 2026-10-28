import { isEntityType } from '../../../../app/utils/entitySchemas'
import { deleteEntitiesBulk } from '../../../utils/entities'

export default defineEventHandler(async (event) => {
  const type = String(getRouterParam(event, 'type'))
  if (!isEntityType(type)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown entity type: ${type}` })
  }
  const body = await readBody<{ ids?: unknown }>(event)
  const ids = Array.isArray(body?.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : []
  if (!ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'ids array is required' })
  }
  const deleted = await deleteEntitiesBulk(type, ids)
  return { ok: true, deleted }
})
