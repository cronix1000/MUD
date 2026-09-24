import { existsSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { runPgDump } from '../../utils/migrate'

function snapshotsDir(): string {
  const dir = process.env.MUD_SNAPSHOTS_DIR
    ?? resolve(process.cwd(), '..', 'ModularMudServer', 'mud.db.snapshots')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export default defineEventHandler(async () => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = snapshotsDir()
  const dest = join(dir, `mud.snap.${ts}.sql`)
  await runPgDump(dest)
  return { path: dest, created: true }
})
