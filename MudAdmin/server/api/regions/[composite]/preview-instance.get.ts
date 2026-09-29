import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath, join } from 'node:path'
import { getPool } from '../../../utils/db'

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

  const res = await getPool().query<{
    id: string
    name: string
  }>(
    `select id, name
       from world.world_regions
      where id = $1`,
    [region_id],
  )
  const region = res.rows[0]

  if (!region) {
    throw createError({ statusCode: 404, statusMessage: `Region not found: ${composite}` })
  }





  return {
    region: {
      id: region.id,
      name: region.name,
    }
  }
})