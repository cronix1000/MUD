<script setup lang="ts">
import { encodeCompositeKey } from '~/utils/composite-key'

definePageMeta({ layout: 'admin' })

interface Room {
  world_id: string
  region_id: string
  room_id: number
  name: string
  terrain: string | null
  width: number | null
  height: number | null
  spawn_x: number | null
  spawn_y: number | null
}

interface Exit {
  id: number
  world_id: string
  region_id: string
  from_room_id: number
  direction: string
  to_room_id: number
  is_portal: number
  portal_name: string | null
  is_one_way: number
}

const route = useRoute()
const compositeKey = computed(() => decodeURIComponent(String(route.params.composite)))
const split = computed(() => compositeKey.value.split('::'))
const world_id = computed(() => split.value[0] ?? '')
const region_id = computed(() => split.value[1] ?? '')

const { data, refresh } = await useFetch<{ rooms: Room[]; exits: Exit[] }>(
  () => `/api/rooms/graph?world_id=${encodeURIComponent(world_id.value)}&region_id=${encodeURIComponent(region_id.value)}`,
)

interface NodePos {
  room: Room
  x: number
  y: number
}

const layout = computed<NodePos[]>(() => {
  const rooms = data.value?.rooms ?? []
  if (!rooms.length) return []

  const byId = new Map<number, Room>()
  for (const r of rooms) byId.set(r.room_id, r)

  const outgoing = new Map<number, Exit[]>()
  for (const e of data.value?.exits ?? []) {
    if (!outgoing.has(e.from_room_id)) outgoing.set(e.from_room_id, [])
    outgoing.get(e.from_room_id)!.push(e)
  }

  const placed = new Set<number>()
  const occupied = new Set<string>()
  const key = (x: number, y: number) => `${x},${y}`
  const result: NodePos[] = []

  const dirs: Record<string, [number, number]> = {
    north: [0, -1],
    south: [0, 1],
    east: [1, 0],
    west: [-1, 0],
    up: [0, 0],
    down: [0, 0],
  }

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
          const off = d ? dirs[d.direction] ?? [1, 0] : [1, 0]
          queue.push({ id: nid, x: x + off[0], y: y + off[1] })
        }
      }
    }
  }

  if (rooms.length) bfsPlacements(rooms[0].room_id)
  for (const r of rooms) if (!placed.has(r.room_id)) bfsPlacements(r.room_id)

  return result
})

const NODE_W = 140
const NODE_H = 60
const PADDING = 40

const viewBox = computed(() => {
  const xs = layout.value.map((n) => n.x)
  const ys = layout.value.map((n) => n.y)
  const minX = Math.min(...xs, 0)
  const minY = Math.min(...ys, 0)
  const maxX = Math.max(...xs, 0)
  const maxY = Math.max(...ys, 0)
  const w = (maxX - minX + 1) * NODE_W + PADDING * 2
  const h = (maxY - minY + 1) * NODE_H + PADDING * 2
  const ox = -minX * NODE_W + PADDING
  const oy = -minY * NODE_H + PADDING
  return { width: w, height: h, ox, oy }
})

function nodePos(n: NodePos) {
  return { cx: viewBox.value.ox + (n.x + 0.5) * NODE_W, cy: viewBox.value.oy + (n.y + 0.5) * NODE_H }
}

function edgeBetween(from: NodePos, to: NodePos) {
  const a = nodePos(from)
  const b = nodePos(to)
  return { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy }
}

const byRoomId = computed(() => new Map(layout.value.map((n) => [n.room.room_id, n])))

const visibleExits = computed(() => {
  const items: Array<{ e: Exit; from: NodePos; to: NodePos }> = []
  for (const e of data.value?.exits ?? []) {
    const from = byRoomId.value.get(e.from_room_id)
    const to = byRoomId.value.get(e.to_room_id)
    if (from && to) items.push({ e, from, to })
  }
  return items
})

const roomHref = (r: Room) => `/admin/world_rooms/${encodeURIComponent(encodeCompositeKey('world_rooms', r))}`

function downloadSvg() {
  const svg = (document.getElementById('region-map-svg') as SVGSVGElement | null)?.outerHTML
  if (!svg) return
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${world_id}-${region_id}-map.svg`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <NuxtLink to="/admin/world/regions" class="text-sky-400 hover:underline text-sm">← regions</NuxtLink>
        <h2 class="text-2xl font-semibold font-mono mt-1">{{ region_id }}</h2>
        <p class="text-neutral-400 text-sm">{{ data?.rooms.length ?? 0 }} rooms, {{ data?.exits.length ?? 0 }} exits</p>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="downloadSvg">
        Download SVG
      </button>
    </div>

    <div v-if="!data?.rooms.length" class="text-neutral-500">
      No rooms in this region yet.
    </div>

    <div v-else class="bg-neutral-900 border border-neutral-800 rounded p-2 overflow-auto">
      <svg
        id="region-map-svg"
        :viewBox="`0 0 ${viewBox.width} ${viewBox.height}`"
        :width="viewBox.width"
        :height="viewBox.height"
        xmlns="http://www.w3.org/2000/svg"
        style="background:#0a0a0a"
      >
        <g>
          <line
            v-for="(item, i) in visibleExits"
            :key="i"
            :x1="edgeBetween(item.from, item.to).x1"
            :y1="edgeBetween(item.from, item.to).y1"
            :x2="edgeBetween(item.from, item.to).x2"
            :y2="edgeBetween(item.from, item.to).y2"
            :stroke="item.e.is_portal ? '#a855f7' : '#525252'"
            :stroke-dasharray="item.e.is_one_way ? '4 3' : ''"
            stroke-width="1.5"
          />
        </g>
        <g>
          <g v-for="n in layout" :key="n.room.room_id">
            <NuxtLink :to="roomHref(n.room)">
              <rect
                :x="viewBox.ox + n.x * NODE_W + 4"
                :y="viewBox.oy + n.y * NODE_H + 4"
                :width="NODE_W - 8"
                :height="NODE_H - 8"
                rx="6"
                fill="#171717"
                stroke="#3f3f46"
                stroke-width="1"
              />
              <text
                :x="viewBox.ox + n.x * NODE_W + NODE_W / 2"
                :y="viewBox.oy + n.y * NODE_H + 22"
                text-anchor="middle"
                fill="#d4d4d8"
                font-family="ui-monospace, monospace"
                font-size="12"
              >
                #{{ n.room.room_id }} {{ n.room.name.length > 14 ? n.room.name.slice(0, 13) + '…' : n.room.name }}
              </text>
              <text
                :x="viewBox.ox + n.x * NODE_W + NODE_W / 2"
                :y="viewBox.oy + n.y * NODE_H + 40"
                text-anchor="middle"
                fill="#71717a"
                font-family="ui-monospace, monospace"
                font-size="10"
              >
                {{ n.room.width }}×{{ n.room.height }}
              </text>
            </NuxtLink>
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>
