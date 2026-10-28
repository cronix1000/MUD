import { isEntityType } from '../../../../app/utils/entitySchemas'
import { countEntities, entityCounts, listEntities } from '../../../utils/entities'

export default defineEventHandler(async (event) => {
  const type = String(getRouterParam(event, 'type'))
  if (!isEntityType(type)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown entity type: ${type}` })
  }
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().toLowerCase()
  const rows = await listEntities(type, {
    q: q || undefined,
    limit: Number(query.limit ?? 200) || 200,
    offset: Number(query.offset ?? 0) || 0,
    sort: String(query.sort ?? 'id'),
  })
  const total = await countEntities(type, q || undefined)
  const counts = query.counts === '1' || query.counts === 'true' ? await entityCounts() : null
  return { type, total, rows, counts }
})
