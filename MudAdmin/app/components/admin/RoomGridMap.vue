<script setup lang="ts">
import { computeGraphLayout, type GraphRoom, type GraphExit } from '~/utils/roomGraph'
import type { Terrain, SpawnMarker } from './AsciiGridPreview.vue'

interface GridRoom {
  room_id: number
  name: string
  zone_id: number | null
  width: number | null
  height: number | null
  layout: string[]
  spawns: SpawnMarker[]
}

interface Cell {
  key: string
  gx: number
  gy: number
  room?: GridRoom
  connect?: { fromRoomId: number; direction: string; fromAll: string[] }
}

const props = defineProps<{
  regionId: string
  rooms: GridRoom[]
  exits: GraphExit[]
  zones: Array<{ zone_id: number; name: string }>
  terrain: Terrain[]
  currentRoomId: number
}>()

const emit = defineEmits<{
  'create-room': [fromRoomId: number | null, direction: string | null]
}>()

const CELL_W = 124
const CELL_H = 108
const DIR_OFFSETS: Array<[string, number, number]> = [
  ['north', 0, -1],
  ['south', 0, 1],
  ['west', -1, 0],
  ['east', 1, 0],
]

const graphRooms = computed<GraphRoom[]>(() =>
  props.rooms.map((r) => ({
    room_id: r.room_id,
    name: r.name,
    region_id: '',
    terrain: null,
    width: r.width,
    height: r.height,
  })),
)

const layout = computed(() => computeGraphLayout(graphRooms.value, props.exits))

const roomAt = computed(() => {
  const byId = new Map(props.rooms.map((r) => [r.room_id, r]))
  const m = new Map<string, GridRoom>()
  for (const n of layout.value) {
    const r = byId.get(n.room.room_id)
    if (r) m.set(`${n.x},${n.y}`, r)
  }
  return m
})

const bounds = computed(() => {
  const pts = layout.value.map((n) => ({ x: n.x, y: n.y }))
  if (!pts.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  return {
    minX: Math.min(...pts.map((p) => p.x)) - 1,
    maxX: Math.max(...pts.map((p) => p.x)) + 1,
    minY: Math.min(...pts.map((p) => p.y)) - 1,
    maxY: Math.max(...pts.map((p) => p.y)) + 1,
  }
})

const gridCols = computed(() => bounds.value.maxX - bounds.value.minX + 1)

const cells = computed<Cell[]>(() => {
  const out: Cell[] = []
  const { minX, maxX, minY, maxY } = bounds.value
  for (let gy = minY; gy <= maxY; gy++) {
    for (let gx = minX; gx <= maxX; gx++) {
      const key = `${gx},${gy}`
      const room = roomAt.value.get(key)
      if (room) {
        out.push({ key, gx, gy, room })
        continue
      }
      const adj: Array<{ id: number; dir: string; label: string }> = []
      for (const [dirFromCell, dx, dy] of DIR_OFFSETS) {
        const n = roomAt.value.get(`${gx + dx},${gy + dy}`)
        if (!n) continue
        const OPP: Record<string, string> = { north: 'south', south: 'north', east: 'west', west: 'east' }
        adj.push({ id: n.room_id, dir: OPP[dirFromCell]!, label: `#${n.room_id} (${OPP[dirFromCell]})` })
      }
      out.push({
        key,
        gx,
        gy,
        connect: adj.length
          ? { fromRoomId: adj[0]!.id, direction: adj[0]!.dir, fromAll: adj.map((a) => a.label) }
          : undefined,
      })
    }
  }
  return out
})

function zoneName(zoneId: number | null): string | null {
  if (!zoneId) return null
  return props.zones.find((z) => z.zone_id === zoneId)?.name ?? `zone ${zoneId}`
}

function previewSize(r: GridRoom): number {
  const rows = r.layout.length
  const cols = r.layout.reduce((m, row) => Math.max(m, row.length), 0)
  if (!rows || !cols) return 4
  return Math.max(2, Math.min(5, Math.floor(96 / cols), Math.floor(64 / rows)))
}

function roomHref(r: GridRoom): string {
  return `/entities/room/${encodeURIComponent(`${props.regionId}::${r.room_id}`)}`
}
</script>

<template>
  <div class="bg-neutral-950 border border-neutral-800 rounded p-4 overflow-auto">
    <div v-if="!rooms.length" class="flex justify-center py-8">
      <button
        class="w-32 h-24 border-2 border-dashed border-neutral-700 rounded-lg text-neutral-500 hover:border-emerald-600 hover:text-emerald-400 text-3xl"
        title="Create the first room in this region"
        @click="emit('create-room', null, null)"
      >+</button>
    </div>

    <div
      v-else
      class="grid gap-2 w-max mx-auto"
      :style="{ gridTemplateColumns: `repeat(${gridCols}, ${CELL_W}px)`, gridAutoRows: CELL_H + 'px' }"
    >
      <template v-for="cell in cells" :key="cell.key">
        <div
          v-if="cell.room"
          class="relative bg-neutral-900 rounded-lg p-2 flex flex-col gap-1"
          :class="cell.room.room_id === currentRoomId ? 'border-2 border-emerald-500' : 'border border-neutral-700'"
        >
          <div class="flex items-baseline justify-between gap-1 min-w-0">
            <span
              class="text-[10px] font-mono shrink-0"
              :class="cell.room.room_id === currentRoomId ? 'text-emerald-300 font-bold' : 'text-neutral-500'"
            >#{{ cell.room.room_id }}</span>
            <span v-if="zoneName(cell.room.zone_id)" class="text-[10px] text-indigo-300 truncate">{{ zoneName(cell.room.zone_id) }}</span>
          </div>
          <NuxtLink
            :to="roomHref(cell.room)"
            class="text-xs font-semibold truncate hover:text-sky-300 hover:underline"
            :title="cell.room.name"
          >{{ cell.room.name || '(unnamed)' }}</NuxtLink>
          <div class="flex-1 flex items-center justify-center overflow-hidden">
            <AsciiGridPreview
              v-if="cell.room.layout.length"
              :layout="cell.room.layout"
              :terrain="terrain"
              :spawns="cell.room.spawns"
              :cell-size="previewSize(cell.room)"
              :show-coords="false"
            />
            <span v-else class="text-[10px] text-neutral-600">no layout</span>
          </div>
          <div class="text-[10px] text-neutral-500 font-mono text-right">{{ cell.room.width }}×{{ cell.room.height }}</div>
        </div>

        <div
          v-else
          class="border border-dashed rounded-lg flex items-center justify-center"
          :class="cell.connect ? 'border-neutral-700' : 'border-neutral-800/50'"
        >
          <button
            v-if="cell.connect"
            class="w-8 h-8 rounded-full text-neutral-500 hover:text-emerald-300 hover:bg-neutral-800 text-xl leading-none"
            :title="`New room — connect from ${cell.connect.fromAll.join(', ')}`"
            @click="emit('create-room', cell.connect.fromRoomId, cell.connect.direction)"
          >+</button>
        </div>
      </template>
    </div>
  </div>
</template>
