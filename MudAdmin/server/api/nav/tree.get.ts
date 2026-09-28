import { getPool } from '../../utils/db'

interface RegionRow { id: string; name: string; region_kind: string | null }
interface RoomRow { region_id: string; room_id: number; name: string }

export default defineEventHandler(async () => {
  const pool = getPool()
  const [regionsR, roomsR] = await Promise.all([
    pool.query<RegionRow>(`select id, name, region_kind from world.world_regions order by id asc`),
    pool.query<RoomRow>(`select region_id, room_id, name from world.world_rooms order by room_id asc`),
  ])
  const regions = regionsR.rows
  const rooms = roomsR.rows
  return {
    regions: regions.map((r) => ({
      ...r,
      rooms: rooms
        .filter((rm) => rm.region_id === r.id)
        .map((rm) => ({ room_id: rm.room_id, name: rm.name })),
    })),
  }
})