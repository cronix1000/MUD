import { unlinkSync, existsSync } from 'node:fs'
import { resolve, basename } from 'node:path'

function safeSnapshotPath(path: string): string {
  const candidates = [
    resolve(process.cwd(), 'ModularMudServer', 'mud.db.snapshots'),
    resolve(process.cwd(), '..', 'ModularMudServer', 'mud.db.snapshots'),
    resolve(process.cwd(), '..', '..', 'ModularMudServer', 'mud.db.snapshots'),
    resolve(process.cwd(), '..', '..', '..', 'ModularMudServer', 'mud.db.snapshots'),
    resolve(process.cwd(), '..', '..', '..', '..', 'ModularMudServer', 'mud.db.snapshots'),
  ]
  const dir = candidates.find((d) => existsSync(d))
  if (!dir) throw createError({ statusCode: 500, statusMessage: 'snapshots dir not found' })
  const resolved = resolve(path)
  if (!resolved.startsWith(dir)) {
    throw createError({ statusCode: 400, statusMessage: 'snapshot path must be inside mud.db.snapshots/' })
  }
  return resolved
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string }>(event)
  if (!body?.path) throw createError({ statusCode: 400, statusMessage: 'path required' })
  const safe = safeSnapshotPath(body.path)
  if (!existsSync(safe)) throw createError({ statusCode: 404, statusMessage: 'snapshot not found' })
  unlinkSync(safe)
  return { deleted: basename(safe) }
})
