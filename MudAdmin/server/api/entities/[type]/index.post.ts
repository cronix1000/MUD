import { isEntityType } from '../../../../app/utils/entitySchemas'
import { parseDoc, upsertEntity } from '../../../utils/entities'

export default defineEventHandler(async (event) => {
  const type = String(getRouterParam(event, 'type'))
  if (!isEntityType(type)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown entity type: ${type}` })
  }
  const body = await readBody<{ id?: string; doc?: unknown; parent_id?: string | null }>(event)
  const id = String(body?.id ?? '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }
  let doc: Record<string, unknown>
  try {
    doc = parseDoc(body?.doc)
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: e instanceof Error ? e.message : 'Invalid doc' })
  }
  try {
    const record = await upsertEntity(type, id, doc, body?.parent_id ?? null)
    return { ok: true, record }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Insert failed'
    throw createError({ statusCode: 400, statusMessage: msg })
  }
})
