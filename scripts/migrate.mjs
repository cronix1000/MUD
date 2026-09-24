#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

if (!process.env.MUD_DATABASE_URL) {
  console.error('MUD_DATABASE_URL is required (e.g. postgresql://mud_prod:pw@host:5432/mud_prod)')
  process.exit(2)
}

const cwd = process.cwd()
const root = resolve(cwd, '..', '..')
const adminDir = resolve(root, 'MudAdmin')

const args = ['--prefix', adminDir, 'exec', '--', 'nuxt', 'prepare']
const prep = spawnSync('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' })
if (prep.status !== 0) {
  console.error('nuxt prepare failed')
  process.exit(prep.status ?? 1)
}

const tsxPath = resolve(adminDir, 'node_modules', 'tsx', 'dist', 'cli.mjs')
if (!existsSync(tsxPath)) {
  console.error('tsx not found in MudAdmin/node_modules')
  process.exit(1)
}

const runner = resolve(adminDir, 'server', 'utils', 'migrate.cli.ts')
const run = spawnSync(
  process.execPath,
  [tsxPath, runner, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env,
  },
)
process.exit(run.status ?? 1)
