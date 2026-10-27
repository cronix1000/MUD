import { isEntityType } from '../../../../app/utils/entitySchemas'
import { getEntity } from '../../../utils/entities'

export default defineEventHandler(async (event) => {
  const type = String(getRouterParam(event, 'type'))
  if (!isEntityType(type)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown entity type: ${type}` })
  }
  const id = decodeURIComponent(String(getRouterParam(event, 'id')))
  const record = await getEntity(type, id)
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: `${type}/${id} not found` })
  }
  return { record }
})
