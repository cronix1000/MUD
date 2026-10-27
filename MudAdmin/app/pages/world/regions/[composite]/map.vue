<script setup lang="ts">
import { computeGraphLayout, graphEdges, type GraphExit, type GraphNodePos } from '~/utils/roomGraph'

definePageMeta({ layout: 'admin' })

type Room = import('~/utils/roomGraph').GraphRoom & {
  spawn_x: number | null
  spawn_y: number | null
}

type Exit = GraphExit & {
  region_id: string
  portal_name: string | null
}

const route = useRoute()
const compositeKey = computed(() => decodeURIComponent(String(route.params.composite)))
const region_id = computed(() => compositeKey.value)

const { data, refresh } = await useFetch<{ rooms: Room[]; exits: Exit[] }>(
  () => `/api/rooms/graph?region_id=${encodeURIComponent(region_id.value)}`,
)

const layout = computed<GraphNodePos[]>(() =>
  computeGraphLayout(data.value?.rooms ?? [], data.value?.exits ?? []),
)

const NODE_W = 140
const NODE_H = 60
const PADDING = 40

interface PlusCell {
  x: number
  y: number
  fromRoomId: number
  direction: string
  fromLabel: string
}

interface EmptyCell {
  x: number
  y: number
  plus?: PlusCell
}

const plusCells = computed<PlusCell[]>(() => {
  const occupied = new Set(layout.value.map((n) => `${n.x},${n.y}`))
  const seen = new Set<string>()
  const out: PlusCell[] = []
  const offsets: Array<[string, number, number]> = [
    ['north', 0, -1],
    ['south', 0, 1],
    ['west', -1, 0],
    ['east', 1, 0],
  ]
  for (const n of layout.value) {
    for (const [dir, dx, dy] of offsets) {
      const px = n.x + dx
      const py = n.y + dy
      const key = `${px},${py}`
      if (occupied.has(key) || seen.has(key)) continue
      seen.add(key)
      out.push({ x: px, y: py, fromRoomId: n.room.room_id, direction: dir, fromLabel: `#${n.room.room_id} ${n.room.name}` })
    }
  }
  return out
})

const emptyCells = computed<EmptyCell[]>(() => {
  if (!layout.value.length) return []
  const xs = layout.value.map((n) => n.x)
  const ys = layout.value.map((n) => n.y)
  const minX = Math.min(...xs) - 1
  const maxX = Math.max(...xs) + 1
  const minY = Math.min(...ys) - 1
  const maxY = Math.max(...ys) + 1
  const occupied = new Set(layout.value.map((n) => `${n.x},${n.y}`))
  const plusAt = new Map(plusCells.value.map((p) => [`${p.x},${p.y}`, p]))
  const out: EmptyCell[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const key = `${x},${y}`
      if (occupied.has(key)) continue
      out.push({ x, y, plus: plusAt.get(key) })
    }
  }
  return out
})

const viewBox = computed(() => {
  const xs = emptyCells.value.map((c) => c.x)
  const ys = emptyCells.value.map((c) => c.y)
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

function nodePos(n: GraphNodePos) {
  return { cx: viewBox.value.ox + (n.x + 0.5) * NODE_W, cy: viewBox.value.oy + (n.y + 0.5) * NODE_H }
}

function edgeBetween(from: GraphNodePos, to: GraphNodePos) {
  const a = nodePos(from)
  const b = nodePos(to)
  return { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy }
}

const visibleExits = computed(() => graphEdges(layout.value, data.value?.exits ?? []))

const roomHref = (r: { region_id: string; room_id: number }) =>
  `/entities/room/${encodeURIComponent(`${r.region_id}::${r.room_id}`)}`

const showAddRoom = ref(false)
const creatingCell = ref<string | null>(null)
const addError = ref<string | null>(null)
const lastCreated = ref<string | null>(null)

const OPPOSITE_DIR: Record<string, string> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
}

async function createRoomFrom(fromRoomId: number, direction: string) {
  const cellKey = `${fromRoomId}:${direction}`
  if (creatingCell.value) return
  creatingCell.value = cellKey
  addError.value = null
  lastCreated.value = null
  try {
    const suggested = await $fetch<{ suggested_room_id: number }>('/api/rooms/next-free-id', {
      query: { region_id: region_id.value },
    })
    const newId = Number(suggested.suggested_room_id)
    if (!Number.isSafeInteger(newId) || newId <= 0) {
      throw new Error('could not determine the next free room id')
    }
    const sourceKey = `${region_id.value}::${fromRoomId}`
    const source = await $fetch<{ record: { doc: Record<string, unknown>; parent_id: string | null } }>(
      `/api/entities/room/${encodeURIComponent(sourceKey)}`,
    ).catch(() => null)
    const sourceDoc = source?.record.doc ?? {}

    const w = 10
    const h = 8
    const newExits: Record<string, Record<string, unknown>> = {}
    const ret = OPPOSITE_DIR[direction]
    if (ret) {
      newExits[ret] = {
        target_room: fromRoomId,
        dest_x: Number(sourceDoc.spawn_x ?? -1),
        dest_y: Number(sourceDoc.spawn_y ?? -1),
        is_one_way: false,
        is_portal: false,
        auto_trigger: true,
      }
    }
    const doc: Record<string, unknown> = {
      region_id: region_id.value,
      room_id: newId,
      name: 'New Room',
      description: '',
      terrain: sourceDoc.terrain ?? null,
      width: w,
      height: h,
      layout: Array.from({ length: h }, () => '.'.repeat(w)),
      spawn_x: 0,
      spawn_y: 0,
      zone_id: Number(sourceDoc.zone_id ?? 0),
      scripts: {},
      exits: newExits,
      spawns: [],
    }
    await $fetch('/api/entities/room', {
      method: 'POST',
      body: { id: `${region_id.value}::${newId}`, doc },
    })

    if (source) {
      const targetDoc = { ...source.record.doc }
      const targetExits = (targetDoc.exits as Record<string, Record<string, unknown>>) ?? {}
      targetExits[direction] = {
        target_room: newId,
        dest_x: -1,
        dest_y: -1,
        is_one_way: false,
        is_portal: false,
        auto_trigger: true,
      }
      targetDoc.exits = targetExits
      await $fetch(`/api/entities/room/${encodeURIComponent(sourceKey)}`, {
        method: 'PUT',
        body: { doc: targetDoc, parent_id: source.record.parent_id },
      }).catch(() => {})
    }

    lastCreated.value = `Room #${newId} created ${direction} of #${fromRoomId}.`
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    addError.value = err.data?.statusMessage ?? err.message ?? 'Create failed'
  } finally {
    creatingCell.value = null
  }
}

function downloadSvg() {
  const svg = (document.getElementById('region-map-svg') as SVGSVGElement | null)?.outerHTML
  if (!svg) return
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${region_id}-map.svg`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <NuxtLink to="/world/regions" class="text-sky-400 hover:underline text-sm">← regions</NuxtLink>
        <h2 class="text-2xl font-semibold font-mono mt-1">{{ region_id }}</h2>
        <p class="text-neutral-400 text-sm">{{ data?.rooms.length ?? 0 }} rooms, {{ data?.exits.length ?? 0 }} exits</p>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="downloadSvg">
        Download SVG
      </button>
    </div>

    <div v-if="addError" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ addError }}</div>
    <div v-if="lastCreated" class="bg-emerald-900/30 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ lastCreated }}</div>

    <AdminAddRoomModal
      v-if="showAddRoom"
      :region-id="region_id"
      @close="showAddRoom = false"
      @created="async () => { showAddRoom = false; await refresh() }"
    />

    <div v-if="!data?.rooms.length" class="bg-neutral-900 border border-neutral-800 rounded p-6 text-center space-y-3">
      <p class="text-neutral-400">No rooms in this region yet.</p>
      <button class="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-sm" @click="showAddRoom = true">
        + Add the first room
      </button>
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
          <template v-for="c in emptyCells" :key="`c-${c.x},${c.y}`">
            <rect
              :x="viewBox.ox + c.x * NODE_W + 4"
              :y="viewBox.oy + c.y * NODE_H + 4"
              :width="NODE_W - 8"
              :height="NODE_H - 8"
              rx="6"
              fill="none"
              :stroke="c.plus ? '#3f3f46' : '#27272a'"
              stroke-dasharray="5 4"
              stroke-width="1"
            />
          </template>
        </g>
        <g>
          <g
            v-for="p in plusCells"
            :key="`p-${p.x},${p.y}`"
            class="plus-cell"
            @click="createRoomFrom(p.fromRoomId, p.direction)"
          >
            <title>New room — {{ p.direction }} of {{ p.fromLabel }}</title>
            <rect
              :x="viewBox.ox + p.x * NODE_W + 4"
              :y="viewBox.oy + p.y * NODE_H + 4"
              :width="NODE_W - 8"
              :height="NODE_H - 8"
              rx="6"
              fill="transparent"
            />
            <text
              :x="viewBox.ox + p.x * NODE_W + NODE_W / 2"
              :y="viewBox.oy + p.y * NODE_H + NODE_H / 2"
              text-anchor="middle"
              dominant-baseline="central"
              fill="#737373"
              font-family="ui-monospace, monospace"
              font-size="20"
            >
              +
            </text>
          </g>
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

<style scoped>
.plus-cell {
  cursor: pointer;
}
.plus-cell:hover rect {
  stroke: #10b981;
  fill: rgba(16, 185, 129, 0.06);
}
.plus-cell:hover text {
  fill: #10b981;
}
</style>
