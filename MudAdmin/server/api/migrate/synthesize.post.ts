import { synthesizeAppliedMigrations } from '../../utils/migrate'

export default defineEventHandler(async () => {
  const result = await synthesizeAppliedMigrations()
  return result
})