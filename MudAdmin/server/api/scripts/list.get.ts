import { listScripts, scriptsRootForClient } from '../../utils/scripts'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const type = typeof query.type === 'string' ? query.type : ''
  const scripts = listScripts(type)
  return {
    type,
    root: scriptsRootForClient(),
    scripts,
  }
})
