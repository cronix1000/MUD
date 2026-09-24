import { copyFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { runPgDump, restoreFromSql } from '../../utils/migrate'

function snapshotsDir(): string {
  return process.env.MUD_SNAPSHOTS_DIR
    ?? resolve(process.cwd(), '..', 'ModularMudServer', 'mud.db.snapshots')
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string }>(event)
  if (!body?.path) throw createError({ statusCode: 400, statusMessage: 'path required' })
  if (!existsSync(body.path)) throw createError({ statusCode: 404, statusMessage: 'snapshot not found' })

  const dir = snapshotsDir()
  const resolved = resolve(body.path)
  if (!resolved.startsWith(resolve(dir))) {
    throw createError({ statusCode: 400, statusMessage: 'snapshot path must be inside mud.db.snapshots/' })
  }

  const safetyBackup = resolve(dir, `mud.snap.pre-restore.${Date.now()}.sql`)
  await runPgDump(safetyBackup)
  await restoreFromSql(resolved)
  return { restored: resolved, safety_backup: safetyBackup, size: statSync(safetyBackup).size }
})
