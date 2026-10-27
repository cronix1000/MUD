import { isEntityType } from '../../../../app/utils/entitySchemas'
import { deleteEntity } from '../../../utils/entities'

export default defineEventHandler(async (event) => {
  const type = String(getRouterParam(event, 'type'))
  if (!isEntityType(type)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown entity type: ${type}` })
  }
  const id = decodeURIComponent(String(getRouterParam(event, 'id')))
  const deleted = await deleteEntity(type, id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: `${type}/${id} not found` })
  }
  return { ok: true }
})
