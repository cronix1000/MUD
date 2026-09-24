import { getPool } from '../../utils/db'

interface WorldRow { id: string; name: string }
interface RegionRow { world_id: string; id: string; name: string; region_kind: string | null }
interface RoomRow { world_id: string; region_id: string; room_id: number; name: string }

export default defineEventHandler(async () => {
  const pool = getPool()
  const [worldsR, regionsR, roomsR] = await Promise.all([
    pool.query<WorldRow>(`select id, name from world.world_worlds order by id asc`),
    pool.query<RegionRow>(`select world_id, id, name, region_kind from world.world_regions order by id asc`),
    pool.query<RoomRow>(`select world_id, region_id, room_id, name from world.world_rooms order by room_id asc`),
  ])
  const worlds = worldsR.rows
  const regions = regionsR.rows
  const rooms = roomsR.rows
  return {
    worlds: worlds.map((w) => ({
      ...w,
      regions: regions
        .filter((r) => r.world_id === w.id)
        .map((r) => ({
          ...r,
          rooms: rooms
            .filter((rm) => rm.world_id === w.id && rm.region_id === r.id)
            .map((rm) => ({ room_id: rm.room_id, name: rm.name })),
        })),
    })),
  }
})
