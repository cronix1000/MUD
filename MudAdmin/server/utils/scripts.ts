import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve as resolvePath, join } from 'node:path'

const ALLOWED_TYPES = new Set(['room', 'quest', 'interactable', 'mob', 'system', 'skills'])
const pExec = promisify(execFile)

function scriptsRoot(): string {
  const envRoot = process.env.MUD_SCRIPTS_PATH
  const candidates = [
    envRoot,
    resolvePath(process.cwd(), '..', 'ModularMudServer', 'scripts'),
    resolvePath(process.cwd(), 'ModularMudServer', 'scripts'),
  ].filter(Boolean) as string[]
  const found = candidates.find((p) => existsSync(p))
  if (!found) {
    throw new Error(`scripts dir not found. Tried:\n${candidates.join('\n')}\nSet MUD_SCRIPTS_PATH to override.`)
  }
  return found
}

function listRecursive(dir: string, base: string): Array<{ path: string; size: number; mtime: number }> {
  const results: Array<{ path: string; size: number; mtime: number }> = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      results.push(...listRecursive(full, base))
    } else if (entry.endsWith('.lua')) {
      const rel = full.slice(base.length + 1).replace(/\\/g, '/')
      results.push({ path: rel, size: st.size, mtime: st.mtimeMs })
    }
  }
  return results
}

export function listScripts(type: string): Array<{ path: string; size: number; mtime: number }> {
  if (!ALLOWED_TYPES.has(type)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown script type: ${type}` })
  }
  const root = scriptsRoot()
  const sub = join(root, type)
  if (!existsSync(sub)) return []
  return listRecursive(sub, root).sort((a, b) => a.path.localeCompare(b.path))
}

export function resolveScriptPath(relPath: string): { abs: string; rel: string } | null {
  if (relPath.includes('..') || relPath.startsWith('/') || /^[a-zA-Z]:/.test(relPath)) {
    return null
  }
  const root = scriptsRoot()
  const abs = join(root, relPath)
  if (!existsSync(abs)) return null
  const normalizedRoot = resolvePath(root)
  const normalizedAbs = resolvePath(abs)
  if (!normalizedAbs.startsWith(normalizedRoot)) {
    return null
  }
  return { abs, rel: relPath }
}

export function readScriptBody(relPath: string): string | null {
  const resolved = resolveScriptPath(relPath)
  if (!resolved) return null
  return readFileSync(resolved.abs, 'utf8')
}

export function scriptsRootForClient(): string {
  return scriptsRoot()
}

export async function validateLuaSyntax(paths: string[]): Promise<Array<{ path: string; ok: boolean; error?: string; missing?: boolean }>> {
  const luacPath = process.env.LUAC_PATH || 'luac'
  const results: Array<{ path: string; ok: boolean; error?: string; missing?: boolean }> = []

  for (const rel of paths) {
    const resolved = resolveScriptPath(rel)
    if (!resolved) {
      results.push({ path: rel, ok: false, missing: true, error: 'file not found or path invalid' })
      continue
    }
    try {
      await pExec(luacPath, ['-p', resolved.abs], { timeout: 5000 })
      results.push({ path: rel, ok: true })
    } catch (e: unknown) {
      const err = e as { stdout?: string | Buffer; stderr?: string | Buffer; code?: string; message?: string }
      if (err.code === 'ENOENT') {
        results.push({ path: rel, ok: true, error: 'luac not installed — skipped (file exists)' })
        continue
      }
      const message = (err.stderr || err.stdout || err.message || 'syntax error').toString().trim()
      results.push({ path: rel, ok: false, error: message })
    }
  }
  return results
}
