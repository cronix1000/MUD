import { getPool } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const region_id = typeof query.region_id === 'string' ? query.region_id : null

  const pool = getPool()

  const roomParams: unknown[] = []
  let roomSql = `select region_id, room_id, name, terrain, width, height, spawn_x, spawn_y from world.world_rooms`
  if (region_id) {
    roomSql += ` where region_id = $1`
    roomParams.push(region_id)
  }
  roomSql += ` order by room_id asc`
  const rooms = (await pool.query(roomSql, roomParams)).rows

  const exitParams: unknown[] = []
  let exitSql = `select id, region_id, from_room_id, direction, to_room_id, is_portal, portal_name, is_one_way from world.world_room_exits`
  if (region_id) {
    exitSql += ` where region_id = $1`
    exitParams.push(region_id)
  }
  const exits = (await pool.query(exitSql, exitParams)).rows

  return { rooms, exits }
})