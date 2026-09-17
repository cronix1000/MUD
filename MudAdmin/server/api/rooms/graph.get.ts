import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const world_id = typeof query.world_id === 'string' ? query.world_id : null
  const region_id = typeof query.region_id === 'string' ? query.region_id : null

  const db = getDb()

  const roomParams: unknown[] = []
  let roomSql = `select world_id, region_id, room_id, name, terrain, width, height, spawn_x, spawn_y from world_rooms`
  if (world_id && region_id) {
    roomSql += ` where world_id = ? and region_id = ?`
    roomParams.push(world_id, region_id)
  } else if (world_id) {
    roomSql += ` where world_id = ?`
    roomParams.push(world_id)
  } else if (region_id) {
    roomSql += ` where region_id = ?`
    roomParams.push(region_id)
  }
  roomSql += ` order by room_id asc`
  const rooms = db.prepare(roomSql).all(...roomParams)

  const exitParams: unknown[] = []
  let exitSql = `select id, world_id, region_id, from_room_id, direction, to_room_id, is_portal, portal_name, is_one_way from world_room_exits`
  if (world_id && region_id) {
    exitSql += ` where world_id = ? and region_id = ?`
    exitParams.push(world_id, region_id)
  } else if (world_id) {
    exitSql += ` where world_id = ?`
    exitParams.push(world_id)
  } else if (region_id) {
    exitSql += ` where region_id = ?`
    exitParams.push(region_id)
  }
  const exits = db.prepare(exitSql).all(...exitParams)

  return { rooms, exits }
})
