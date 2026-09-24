import { ensureSchemas, runPendingMigrations, getAppliedMigrations, getPendingMigrations, listBackups } from './migrate'

const args = new Set(process.argv.slice(2))
const wantBackup = !args.has('--no-backup')
const skipArg = [...args].find((a) => a.startsWith('--skip='))
const skipVersions = skipArg ? skipArg.slice('--skip='.length).split(',').map(Number).filter(Number.isFinite) : undefined
const dryRun = args.has('--dry-run')

async function main() {
  if (!process.env.MUD_DATABASE_URL) {
    console.error('MUD_DATABASE_URL is required.')
    process.exit(2)
  }
  await ensureSchemas()

  if (args.has('--list')) {
    const applied = await getAppliedMigrations()
    const pending = await getPendingMigrations()
    console.log('Applied:', applied.map((m) => `${m.version} ${m.name}`).join('\n  ') || '  (none)')
    console.log('Pending:', pending.map((m) => `${m.version} ${m.name}`).join('\n  ') || '  (none)')
    process.exit(0)
  }

  if (dryRun) {
    const applied = new Set((await getAppliedMigrations()).map((m) => m.version))
    const skipSet = new Set(skipVersions ?? [])
    const allPending = await getPendingMigrations()
    const filtered = allPending.filter((m) => !skipSet.has(m.version))
    console.log('Pending migrations that would run:')
    for (const m of filtered) console.log(`  ${m.version} ${m.name}`)
    process.exit(0)
  }

  const result = await runPendingMigrations({ backup: wantBackup, skipVersions })
  console.log(`backup: ${result.backup ?? '(none)'}`)
  for (const r of result.results) {
    console.log(`  ${r.ok ? 'OK' : 'FAIL'}  ${r.version}  ${r.name}${r.error ? `\n        ${r.error}` : ''}`)
  }
  process.exit(result.results.some((r) => !r.ok) ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
