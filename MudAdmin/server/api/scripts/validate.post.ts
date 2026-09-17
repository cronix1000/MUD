import { validateLuaSyntax } from '../../utils/scripts'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ paths?: string[] }>(event)
  if (!body || !Array.isArray(body.paths)) {
    throw createError({ statusCode: 400, statusMessage: 'Expected { paths: string[] }' })
  }
  const results = await validateLuaSyntax(body.paths)
  return { results }
})
