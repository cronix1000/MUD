import { getAppliedMigrations, getPendingMigrations, listBackups } from '../../utils/migrate'

export default defineEventHandler(async () => {
  const [applied, pending, backups] = await Promise.all([
    getAppliedMigrations(),
    getPendingMigrations(),
    listBackups(),
  ])
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
