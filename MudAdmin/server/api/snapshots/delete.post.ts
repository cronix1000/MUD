import { unlinkSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

function snapshotsDir(): string {
  return process.env.MUD_SNAPSHOTS_DIR
    ?? resolve(process.cwd(), '..', 'ModularMudServer', 'mud.db.snapshots')
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string }>(event)
  if (!body?.path) throw createError({ statusCode: 400, statusMessage: 'path required' })

  const dir = resolve(snapshotsDir())
  const resolved = resolve(body.path)
  if (!resolved.startsWith(dir)) {
    throw createError({ statusCode: 400, statusMessage: 'snapshot path must be inside mud.db.snapshots/' })
  }
  if (!existsSync(resolved)) throw createError({ statusCode: 404, statusMessage: 'snapshot not found' })
  const size = statSync(resolved).size
  unlinkSync(resolved)
  return { deleted: resolved, size }
})
