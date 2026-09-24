import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

function snapshotsDir(): string {
  return process.env.MUD_SNAPSHOTS_DIR
    ?? resolve(process.cwd(), '..', 'ModularMudServer', 'mud.db.snapshots')
}

export default defineEventHandler(() => {
  const dir = snapshotsDir()
  if (!existsSync(dir)) return { snapshots: [] }
  const snapshots = readdirSync(dir)
    .filter((f) => f.startsWith('mud.snap.') && f.endsWith('.sql'))
    .map((f) => {
      const full = join(dir, f)
      const st = statSync(full)
      return { path: full, mtime: st.mtimeMs, size: st.size }
    })
    .sort((a, b) => b.mtime - a.mtime)
  return { snapshots }
})
