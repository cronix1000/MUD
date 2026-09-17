import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
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

export default defineEventHandler(() => {
  const src = dbPath()
  const dir = snapshotsDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = join(dir, `${src.split(/[\\/]/).pop()}.snap.${ts}`)
  copyFileSync(src, dest)
  return { path: dest, created: true }
})
