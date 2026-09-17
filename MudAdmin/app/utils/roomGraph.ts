export interface GraphRoom {
  room_id: number
  name: string
  world_id: string
  region_id: string
  terrain?: string | null
  width?: number | null
  height?: number | null
}

export interface GraphExit {
  id: number
  from_room_id: number
  to_room_id: number
  direction: string
  is_portal?: number
  is_one_way?: number
}

export interface GraphNodePos {
  room: GraphRoom
  x: number
  y: number
}

export interface GraphEdge {
  e: GraphExit
  from: GraphNodePos
  to: GraphNodePos
}

const DIRS: Record<string, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
  up: [0, 0],
  down: [0, 0],
}

export function computeGraphLayout(rooms: GraphRoom[], exits: GraphExit[]): GraphNodePos[] {
  if (!rooms.length) return []

  const byId = new Map<number, GraphRoom>()
  for (const r of rooms) byId.set(r.room_id, r)

  const outgoing = new Map<number, GraphExit[]>()
  for (const e of exits) {
    if (!outgoing.has(e.from_room_id)) outgoing.set(e.from_room_id, [])
    outgoing.get(e.from_room_id)!.push(e)
  }

  const placed = new Set<number>()
  const occupied = new Set<string>()
  const key = (x: number, y: number) => `${x},${y}`
  const result: GraphNodePos[] = []

  const neighbors = (roomId: number): number[] => {
    const list: number[] = []
    for (const e of outgoing.get(roomId) ?? []) {
      if (byId.has(e.to_room_id) && e.to_room_id !== roomId) list.push(e.to_room_id)
    }
    return list
  }

  const bfsPlacements = (seedId: number) => {
    const queue: { id: number; x: number; y: number }[] = [{ id: seedId, x: 0, y: 0 }]
    while (queue.length) {
      const { id, x, y } = queue.shift()!
      if (placed.has(id)) continue
      if (occupied.has(key(x, y))) {
        let found = false
        for (let r = 1; !found; r++) {
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
              const nx = x + dx
              const ny = y + dy
              if (!occupied.has(key(nx, ny))) {
                queue.push({ id, x: nx, y: ny })
                found = true
              }
            }
          }
        }
        continue
      }
      occupied.add(key(x, y))
      placed.add(id)
      result.push({ room: byId.get(id)!, x, y })
      for (const nid of neighbors(id)) {
        if (!placed.has(nid)) {
          const d = outgoing.get(id)!.find((e) => e.to_room_id === nid)
          const off: [number, number] = (d ? DIRS[d.direction] : undefined) ?? [1, 0]
          queue.push({ id: nid, x: x + off[0], y: y + off[1] })
        }
      }
    }
  }

  if (rooms.length) bfsPlacements(rooms[0]!.room_id)
  for (const r of rooms) if (!placed.has(r.room_id)) bfsPlacements(r.room_id)
  return result
}

export function computeGraphViewBox(layout: GraphNodePos[], nodeW: number, nodeH: number, padding: number) {
  if (!layout.length) return { width: padding * 2, height: padding * 2, ox: padding, oy: padding }
  const xs = layout.map((n) => n.x)
  const ys = layout.map((n) => n.y)
  const minX = Math.min(...xs, 0)
  const minY = Math.min(...ys, 0)
  const maxX = Math.max(...xs, 0)
  const maxY = Math.max(...ys, 0)
  const w = (maxX - minX + 1) * nodeW + padding * 2
  const h = (maxY - minY + 1) * nodeH + padding * 2
  const ox = -minX * nodeW + padding
  const oy = -minY * nodeH + padding
  return { width: w, height: h, ox, oy }
}

export function graphEdges(layout: GraphNodePos[], exits: GraphExit[]): GraphEdge[] {
  const byRoomId = new Map(layout.map((n) => [n.room.room_id, n]))
  const items: GraphEdge[] = []
  for (const e of exits) {
    const from = byRoomId.get(e.from_room_id)
    const to = byRoomId.get(e.to_room_id)
    if (from && to) items.push({ e, from, to })
  }
  return items
}
