import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

function dbPath(): string {
  const envRoot = process.env.MUD_DB_PATH
  const candidates = [
    envRoot,
    resolve(process.cwd(), 'ModularMudServer', 'mud.db'),
    resolve(process.cwd(), '..', 'ModularMudServer', 'mud.db'),
    resolve(process.cwd(), '..', '..', 'ModularMudServer', 'mud.db'),
    resolve(process.cwd(), '..', '..', '..', 'ModularMudServer', 'mud.db'),
    resolve(process.cwd(), '..', '..', '..', '..', 'ModularMudServer', 'mud.db'),
  ].filter(Boolean) as string[]
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error('mud.db not found')
  return found
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string }>(event)
  if (!body?.path) throw createError({ statusCode: 400, statusMessage: 'path required' })
  if (!existsSync(body.path)) throw createError({ statusCode: 404, statusMessage: 'snapshot not found' })

  const db = dbPath()
  const safetyBackup = `${db}.pre-restore.${Date.now()}`
  copyFileSync(db, safetyBackup)
  copyFileSync(body.path, db)
  return { restored: body.path, safety_backup: safetyBackup }
})
