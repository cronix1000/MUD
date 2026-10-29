import { requireConsoleToken, runConsoleCommand } from '../../utils/console'

export default defineEventHandler(async (event) => {
  requireConsoleToken(event)
  try {
    const output = await runConsoleCommand('restart')
    return { output }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Restart failed'
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
