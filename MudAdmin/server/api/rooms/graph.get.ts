import { getPool } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const world_id = typeof query.world_id === 'string' ? query.world_id : null
  const region_id = typeof query.region_id === 'string' ? query.region_id : null

  const pool = getPool()

  const roomParams: unknown[] = []
  let roomSql = `select world_id, region_id, room_id, name, terrain, width, height, spawn_x, spawn_y from world.world_rooms`
  if (world_id && region_id) {
    roomSql += ` where world_id = $1 and region_id = $2`
    roomParams.push(world_id, region_id)
  } else if (world_id) {
    roomSql += ` where world_id = $1`
    roomParams.push(world_id)
  } else if (region_id) {
    roomSql += ` where region_id = $1`
    roomParams.push(region_id)
  }
  roomSql += ` order by room_id asc`
  const rooms = (await pool.query(roomSql, roomParams)).rows

  const exitParams: unknown[] = []
  let exitSql = `select id, world_id, region_id, from_room_id, direction, to_room_id, is_portal, portal_name, is_one_way from world.world_room_exits`
  if (world_id && region_id) {
    exitSql += ` where world_id = $1 and region_id = $2`
    exitParams.push(world_id, region_id)
  } else if (world_id) {
    exitSql += ` where world_id = $1`
    exitParams.push(world_id)
  } else if (region_id) {
    exitSql += ` where region_id = $1`
    exitParams.push(region_id)
  }
  const exits = (await pool.query(exitSql, exitParams)).rows

  return { rooms, exits }
})
