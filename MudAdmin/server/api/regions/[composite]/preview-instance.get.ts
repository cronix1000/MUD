import { getEntity } from '../../../utils/entities'
import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath, join } from 'node:path'

function scriptsRoot(): string {
  const envRoot = process.env.MUD_SCRIPTS_PATH
  const candidates = [
    envRoot,
    resolvePath(process.cwd(), '..', 'ModularMudServer', 'scripts'),
    resolvePath(process.cwd(), 'ModularMudServer', 'scripts'),
  ].filter(Boolean) as string[]
  const found = candidates.find((p) => existsSync(p))
  return found ?? ''
}

export default defineEventHandler(async (event) => {
  const composite = decodeURIComponent(getRouterParam(event, 'composite') ?? '')
  const region_id = composite
  if (!region_id) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid region key' })
  }

  const record = await getEntity('region', region_id)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: `Region not found: ${composite}` })
  }

  const region = { id: record.entity_id, name: String(record.doc.name ?? record.entity_id) }





  return {
    region: {
      id: region.id,
      name: region.name,
    }
  }
})