import { runPendingMigrations } from '../../utils/migrate'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ backup?: boolean; skipVersions?: number[] }>(event).catch(() => ({}) as { backup?: boolean; skipVersions?: number[] })
  const backup = body?.backup ?? true
  const skipVersions = body?.skipVersions ?? []
  const result = runPendingMigrations({ backup, skipVersions })
  return result
})
