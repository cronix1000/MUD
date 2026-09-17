import { getDb } from '../../utils/db'

interface WorldRow { id: string; name: string }
interface RegionRow { world_id: string; id: string; name: string; region_kind: string | null }
interface RoomRow { world_id: string; region_id: string; room_id: number; name: string }

export default defineEventHandler(() => {
  const db = getDb()
  const worlds = db.prepare(`select id, name from world_worlds order by id asc`).all() as WorldRow[]
  const regions = db.prepare(`select world_id, id, name, region_kind from world_regions order by id asc`).all() as RegionRow[]
  const rooms = db.prepare(`select world_id, region_id, room_id, name from world_rooms order by room_id asc`).all() as RoomRow[]
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
