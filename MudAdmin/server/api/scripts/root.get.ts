import { scriptsRootForClient } from '../../utils/scripts'

export default defineEventHandler(() => {
  return { root: scriptsRootForClient() }
})
