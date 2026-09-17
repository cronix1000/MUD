import { copyFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'

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

function snapshotsDir(): string {
  const db = dbPath()
  return join(dirname(db), 'mud.db.snapshots')
}

function listSnapshots(): Array<{ path: string; mtime: number; size: number }> {
  const dir = snapshotsDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.includes('.snap.'))
    .map((f) => {
      const full = join(dir, f)
      const st = statSync(full)
      return { path: full, mtime: st.mtimeMs, size: st.size }
    })
    .sort((a, b) => b.mtime - a.mtime)
}

export default defineEventHandler(() => {
  return { snapshots: listSnapshots() }
})
