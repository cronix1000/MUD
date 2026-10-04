import { getPool } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const region_id = typeof query.region_id === 'string' ? query.region_id : null
  const from_room_id_raw = query.from_room_id

  if (!region_id) {
    throw createError({ statusCode: 400, statusMessage: 'region_id is required' })
  }

  const pool = getPool()
  const fromRoomId = Number.isFinite(Number(from_room_id_raw)) ? Math.trunc(Number(from_room_id_raw)) : null

  const used = (await pool.query(
    `select room_id from world.world_rooms where region_id = $1 order by room_id asc`,
    [region_id]
  )).rows.map((r) => Number(r.room_id))

  let candidate: number
  let reason: 'from_room_id_plus_one' | 'max_plus_one' | 'first_gap' | 'one_when_empty' | 'first_gap_after_max'

  if (fromRoomId !== null) {
    candidate = fromRoomId + 1
    reason = 'from_room_id_plus_one'
  } else if (used.length === 0) {
    candidate = 1
    reason = 'one_when_empty'
  } else {
    const maxId = used[used.length - 1] as number
    const maxPlus = maxId + 1
    if (!Number.isSafeInteger(maxPlus) || maxPlus > 2_000_000_000) {
      const gap = used.find((id, i) => i > 0 && id - (used[i - 1] as number) > 1)
      candidate = gap !== undefined ? gap - 1 : maxPlus
      reason = 'first_gap_after_max'
    } else if (used.includes(maxPlus)) {
      const gap = used.find((id, i) => i > 0 && id - (used[i - 1] as number) > 1)
      candidate = gap !== undefined ? gap - 1 : maxPlus
      reason = 'first_gap'
    } else {
      candidate = maxPlus
      reason = 'max_plus_one'
    }
  }

  while (used.includes(candidate) && candidate < 2_147_483_647) {
    candidate += 1
    reason = 'first_gap'
  }

  const collidesWith = used.includes(candidate)
    ? { room_id: candidate, name: null }
    : null

  return {
    region_id,
    from_room_id: fromRoomId,
    suggested_room_id: candidate,
    reason,
    used_room_ids: used,
    collides: collidesWith,
    upper_bound: 2_147_483_647,
  }
})