#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const cwd = process.cwd()
const root = resolve(cwd, '..', '..')
const serverDir = resolve(root, 'ModularMudServer')
const adminDir = resolve(root, 'MudAdmin')

const envPath = process.env.MUD_DB_PATH ?? resolve(serverDir, 'mud.world.db')
const playersPath = process.env.MUD_PLAYERS_DB ?? envPath.replace(/\.world\.db$/, '.players.db')

if (!existsSync(envPath)) {
  console.error(`world DB not found at ${envPath}`)
  process.exit(1)
}

process.env.MUD_DB_PATH = envPath
process.env.MUD_PLAYERS_DB = playersPath

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
  [tsxPath, runner],
  {
    stdio: 'inherit',
    env: { ...process.env, MUD_DB_PATH: envPath, MUD_PLAYERS_DB: playersPath },
  },
)
process.exit(run.status ?? 1)
