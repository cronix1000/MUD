import { getAppliedMigrations, getPendingMigrations, listBackups } from '../../utils/migrate'

export default defineEventHandler(() => {
  const applied = getAppliedMigrations()
  const pending = getPendingMigrations()
  const backups = listBackups()
  return {
    applied,
    pending: pending.map((p) => ({
      version: p.version,
      name: p.name,
      sql: p.sql,
    })),
    backups,
  }
})
