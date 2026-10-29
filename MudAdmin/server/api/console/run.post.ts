import { assertCommand, requireConsoleToken, runConsoleCommand } from '../../utils/console'

export default defineEventHandler(async (event) => {
  requireConsoleToken(event)
  const body = await readBody(event).catch(() => ({}))
  const command = assertCommand(body?.command)
  try {
    const output = await runConsoleCommand(command)
    return { output }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Console command failed'
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
