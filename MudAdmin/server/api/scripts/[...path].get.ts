import { readScriptBody } from '../../utils/scripts'

export default defineEventHandler((event) => {
  const rel = getRouterParam(event, 'path')
  if (!rel) {
    throw createError({ statusCode: 400, statusMessage: 'Missing script path' })
  }
  const body = readScriptBody(rel)
  if (body === null) {
    throw createError({ statusCode: 404, statusMessage: `Script not found: ${rel}` })
  }
  return { path: rel, body }
})
