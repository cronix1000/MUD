import { isConsoleEnabled } from '../../utils/console'

export default defineEventHandler(() => {
  return { enabled: isConsoleEnabled() }
})
