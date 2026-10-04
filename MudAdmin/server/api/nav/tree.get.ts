import { getPool } from '../../utils/db'

interface RegionRow { id: string; name: string; region_kind: string | null }
interface RoomRow { region_id: string; room_id: number; name: string; zone_id: number | null }
interface ZoneRow { region_id: string; zone_id: number; name: string }

export default defineEventHandler(async () => {
  const pool = getPool()
  const [regionsR, roomsR, zonesR] = await Promise.all([
    pool.query<RegionRow>(`select id, name from world.world_regions order by id asc`),
    pool.query<RoomRow>(`select region_id, room_id, name, zone_id from world.world_rooms order by room_id asc`),
    pool.query<ZoneRow>(`select region_id, zone_id, name from world.world_zones order by zone_id asc`),
  ])
  const regions = regionsR.rows
  const rooms = roomsR.rows
  const zones = zonesR.rows
  return {
    regions: regions.map((r) => ({
      ...r,
      zones: zones
        .filter((z) => z.region_id === r.id)
        .map((z) => ({ zone_id: z.zone_id, name: z.name })),
      rooms: rooms
        .filter((rm) => rm.region_id === r.id && (!rm.zone_id || rm.zone_id === 0))
        .map((rm) => ({ room_id: rm.room_id, name: rm.name })),
    })),
  }
})