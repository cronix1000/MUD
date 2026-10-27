import { getPool } from '../../utils/db'

interface RoomDocRow {
  entity_id: string
  doc: {
    region_id?: string
    room_id?: number
    name?: string
    terrain?: string | null
    width?: number | null
    height?: number | null
    spawn_x?: number | null
    spawn_y?: number | null
    exits?: Record<string, Record<string, unknown>>
  }
}

interface FlatExit {
  id: number
  region_id: string
  from_room_id: number
  direction: string
  to_room_id: number
  is_portal: boolean
  portal_name: string | null
  is_one_way: boolean
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const region_id = typeof query.region_id === 'string' ? query.region_id : null

  const pool = getPool()

  const params: unknown[] = ['room']
  let sql = `select entity_id, doc from world.entities where entity_type = $1`
  if (region_id) {
    sql += ` and doc->>'region_id' = $2`
    params.push(region_id)
  }
  sql += ` order by (doc->>'room_id')::int asc`
  const rows = (await pool.query<RoomDocRow>(sql, params)).rows

  const rooms = rows.map((r) => ({
    region_id: String(r.doc.region_id ?? ''),
    room_id: Number(r.doc.room_id ?? 0),
    name: String(r.doc.name ?? ''),
    terrain: r.doc.terrain ?? null,
    width: r.doc.width ?? null,
    height: r.doc.height ?? null,
    spawn_x: r.doc.spawn_x ?? null,
    spawn_y: r.doc.spawn_y ?? null,
  }))

  const exits: FlatExit[] = []
  let exitId = 0
  for (const r of rows) {
    const fromRoom = Number(r.doc.room_id ?? 0)
    const regionId = String(r.doc.region_id ?? '')
    for (const [direction, e] of Object.entries(r.doc.exits ?? {})) {
      exits.push({
        id: ++exitId,
        region_id: regionId,
        from_room_id: fromRoom,
        direction,
        to_room_id: Number(e.target_room ?? 0),
        is_portal: Boolean(e.is_portal),
        portal_name: e.portal_name ? String(e.portal_name) : null,
        is_one_way: Boolean(e.is_one_way),
      })
    }
  }

  return { rooms, exits }
})
