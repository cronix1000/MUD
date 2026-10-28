import { isEntityType } from '../../../../../app/utils/entitySchemas'
import { getPool } from '../../../../utils/db'

interface Ref {
  entity_type: string
  entity_id: string
  field: string
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function scanDoc(rowType: string, rowId: string, doc: Record<string, unknown>, type: string, id: string): Ref[] {
  const refs: Ref[] = []
  const hit = (field: string, value: unknown) => {
    if (value === id) refs.push({ entity_type: rowType, entity_id: rowId, field })
  }

  const components = asObj(doc.components)

  switch (rowType) {
    case 'mob':
      hit('loot_drop', doc.loot_drop)
      for (const [i, s] of asArray(doc.attack_patterns).entries()) {
        if (asObj(s).damage_type === id) refs.push({ entity_type: rowType, entity_id: rowId, field: `attack_patterns[${i}].damage_type` })
      }
      break
    case 'item':
      hit('components.weapon.defaultSkill', components.weapon && asObj(components.weapon).defaultSkill)
      for (const [i, s] of asArray(components.passive_skills).entries()) {
        if (s === id) refs.push({ entity_type: rowType, entity_id: rowId, field: `components.passive_skills[${i}]` })
      }
      break
    case 'interactable':
      hit('components.chest.loot_table', asObj(components.chest).loot_table)
      hit('components.loot.table', asObj(components.loot).table)
      break
    case 'loot_table':
      for (const [i, e] of asArray(doc.entries).entries()) {
        if (asObj(e).id === id) refs.push({ entity_type: rowType, entity_id: rowId, field: `entries[${i}].id` })
      }
      break
    case 'recipe':
      hit('skill_id', doc.skill_id)
      for (const [i, e] of asArray(doc.inputs).entries()) {
        if (asObj(e).template_id === id || asObj(e).item_id === id) refs.push({ entity_type: rowType, entity_id: rowId, field: `inputs[${i}]` })
      }
      for (const [i, e] of asArray(doc.outputs).entries()) {
        if (asObj(e).template_id === id || asObj(e).item_id === id) refs.push({ entity_type: rowType, entity_id: rowId, field: `outputs[${i}]` })
      }
      break
    case 'skill':
      hit('category_id', doc.category_id)
      break
    case 'shop':
      hit('mob_id', doc.mob_id)
      if (id in asObj(doc.inventory)) refs.push({ entity_type: rowType, entity_id: rowId, field: 'inventory' })
      break
    case 'faction':
      if (id in asObj(doc.relations)) refs.push({ entity_type: rowType, entity_id: rowId, field: 'relations' })
      break
    case 'dialogue':
      for (const [i, o] of asArray(doc.options).entries()) {
        if (asObj(o).targetNode === id) refs.push({ entity_type: rowType, entity_id: rowId, field: `options[${i}].targetNode` })
      }
      break
    case 'zone':
      hit('region_id', doc.region_id)
      break
    case 'room': {
      if (doc.region_id === id) refs.push({ entity_type: rowType, entity_id: rowId, field: 'region_id' })
      for (const [i, s] of asArray(doc.spawns).entries()) {
        if (asObj(s).template_id === id) refs.push({ entity_type: rowType, entity_id: rowId, field: `spawns[${i}].template_id` })
      }
      if (type === 'room') {
        const selfRegion = String(id.split('::')[0] ?? '')
        const selfRoom = Number(id.split('::')[1])
        if (String(doc.region_id ?? rowId.split('::')[0] ?? '') === selfRegion && Number.isFinite(selfRoom)) {
          for (const [dir, e] of Object.entries(asObj(doc.exits))) {
            if (asObj(e).target_room === selfRoom) {
              refs.push({ entity_type: rowType, entity_id: rowId, field: `exits.${dir}.target_room` })
            }
          }
        }
      }
      break
    }
  }
  return refs
}

export default defineEventHandler(async (event) => {
  const type = String(getRouterParam(event, 'type'))
  if (!isEntityType(type)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown entity type: ${type}` })
  }
  const id = decodeURIComponent(String(getRouterParam(event, 'id')))

  const res = await getPool().query<{ entity_type: string; entity_id: string; doc: Record<string, unknown> }>(
    `SELECT entity_type, entity_id, doc FROM world.entities WHERE NOT (entity_type = $1 AND entity_id = $2)`,
    [type, id],
  )

  const references: Ref[] = []
  for (const row of res.rows) {
    references.push(...scanDoc(row.entity_type, row.entity_id, row.doc ?? {}, type, id))
  }
  return { references }
})
