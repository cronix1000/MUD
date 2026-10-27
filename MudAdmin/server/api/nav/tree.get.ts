import { getPool } from '../../utils/db'

interface RegionRow { id: string; name: string; region_kind: string | null }
interface RoomRow { region_id: string; room_id: number; name: string; zone_id: number | null }
interface ZoneRow { region_id: string; zone_id: number; name: string }

export default defineEventHandler(async () => {
  const pool = getPool()
  const [regionsR, roomsR, zonesR] = await Promise.all([
    pool.query<RegionRow>(
      `select entity_id as id, doc->>'name' as name
         from world.entities
        where entity_type = 'region'
        order by id asc`,
    ),
    pool.query<RoomRow>(
      `select doc->>'region_id' as region_id, (doc->>'room_id')::int as room_id,
              doc->>'name' as name, (doc->>'zone_id')::int as zone_id
         from world.entities
        where entity_type = 'room'
        order by room_id asc`,
    ),
    pool.query<ZoneRow>(
      `select doc->>'region_id' as region_id, (doc->>'zone_id')::int as zone_id, doc->>'name' as name
         from world.entities
        where entity_type = 'zone'
        order by zone_id asc`,
    ),
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