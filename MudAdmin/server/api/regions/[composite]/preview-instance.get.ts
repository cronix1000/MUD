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
  const [world_id, region_id] = composite.split('::')
  if (!world_id || !region_id) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid region key' })
  }

  const res = await getPool().query<{
    id: string
    name: string
    region_kind: string | null
    generator_script: string | null
    template_config_json: string | null
    tutorial_steps_json: string | null
  }>(
    `select id, name, region_kind, generator_script, template_config_json, tutorial_steps_json
       from world.world_regions
      where world_id = $1 and id = $2`,
    [world_id, region_id],
  )
  const region = res.rows[0]

  if (!region) {
    throw createError({ statusCode: 404, statusMessage: `Region not found: ${composite}` })
  }

  let generatorBody: string | null = null
  if (region.generator_script) {
    const root = scriptsRoot()
    const path = join(root, region.generator_script)
    if (existsSync(path)) {
      generatorBody = readFileSync(path, 'utf8')
    } else {
      generatorBody = null
    }
  }

  let templateConfig: unknown = null
  if (region.template_config_json) {
    try {
      templateConfig = JSON.parse(region.template_config_json)
    } catch {
      templateConfig = { _error: 'invalid JSON' }
    }
  }

  let tutorialSteps: unknown = null
  if (region.tutorial_steps_json) {
    try {
      tutorialSteps = JSON.parse(region.tutorial_steps_json)
    } catch {
      tutorialSteps = { _error: 'invalid JSON' }
    }
  }

  return {
    region: {
      world_id,
      id: region.id,
      name: region.name,
      region_kind: region.region_kind ?? 'static',
    },
    generator_script: region.generator_script,
    generator_body: generatorBody,
    template_config_json: templateConfig,
    tutorial_steps_json: tutorialSteps,
    preview_note: region.generator_script
      ? generatorBody
        ? `Generator script loaded (${generatorBody.length} chars). Preview runs at runtime when a player enters the region (C++ server calls the generator with template_config_json, rooms/exits/spawns materialize in-memory).`
        : `Generator script '${region.generator_script}' referenced but not found on disk under MUD_SCRIPTS_PATH.`
      : 'No generator_script set — this is a static region.',
  }
})
