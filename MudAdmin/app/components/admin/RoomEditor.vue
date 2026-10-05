<script setup lang="ts">
import { encodeCompositeKey } from '~/utils/composite-key'
import { computeGraphLayout, computeGraphViewBox, graphEdges, type GraphRoom, type GraphExit } from '~/utils/roomGraph'
import { resolveWikiId } from '~/utils/wikiId'
import ScriptPicker from './ScriptPicker.vue'

interface TerrainRow {
  symbol: string
  name: string
  color: string | null
}

interface ExitRow {
  id?: number
  direction: string
  target_room: number
  dest_x: number
  dest_y: number
  is_portal: boolean
  portal_name: string
  auto_trigger: boolean
  is_one_way: boolean
  _deleted?: boolean
  _isNew?: boolean
  _targetRoomInput?: string
}

interface SpawnRow {
  id?: number
  x: number
  y: number
  type: string
  template_id: string
  respawn_time: number
  is_respawning: boolean
  override_json: string
  _deleted?: boolean
  _isNew?: boolean
}

interface ScriptRef {
  on_enter?: string | null
  on_exit?: string | null
  on_pulse?: string | null
}

const props = defineProps<{
  compositeKey: string
}>()

const emit = defineEmits<{ close: [] }>()

interface RoomRow {
  region_id: string
  room_id: number
  name: string
  description: string | null
  terrain: string | null
  width: number | null
  height: number | null
  layout_json: string | null
  spawn_x: number | null
  spawn_y: number | null
  scripts_json: string | null
  extra_json: string | null
  zone_id: number | null
}

interface ZoneRow {
  region_id: string
  zone_id: number
  name: string
}

interface ColumnInfo { name: string; type: string; pk: number; dflt_value: unknown; notnull: number }

const split = computed(() => decodeURIComponent(props.compositeKey).split('::'))
const regionId = computed(() => split.value[0] ?? '')
const roomId = computed(() => Number(split.value[1] ?? 0))

const { data: roomData, refresh: refreshRoom } = await useFetch<{ columns: ColumnInfo[]; rows: Record<string, unknown>[] }>(
  () => `/api/tables/world_rooms`,
)
const { data: terrainsData } = await useFetch<{ rows: TerrainRow[] }>(`/api/tables/world_terrains`)
const { data: exitsData, refresh: refreshExits } = await useFetch<{ rows: Array<Record<string, unknown>> }>(
  `/api/tables/world_room_exits`,
)
const { data: spawnsData, refresh: refreshSpawns } = await useFetch<{ rows: Array<Record<string, unknown>> }>(
  `/api/tables/world_room_spawns`,
)
const { data: zonesData } = await useFetch<{ rows: ZoneRow[] }>('/api/tables/world_zones')
const zonesInRegion = computed<ZoneRow[]>(() =>
  (zonesData.value?.rows ?? []).filter((z) => z.region_id === regionId.value),
)

const room = computed<RoomRow | undefined>(() => {
  const rows = roomData.value?.rows ?? []
  return rows.find(
    (r) =>
      String(r.region_id) === regionId.value &&
      Number(r.room_id) === roomId.value,
  ) as RoomRow | undefined
})

const regionRoomIds = computed<Set<number>>(() => {
  const set = new Set<number>()
  for (const r of roomData.value?.rows ?? []) {
    if (String(r.region_id) === regionId.value) {
      set.add(Number(r.room_id))
    }
  }
  return set
})

const visibleExits = computed(() => exits.value.filter((x) => !x._deleted))
const selfLoopExits = computed(() =>
  visibleExits.value.filter((e) => Number(e.target_room) === roomId.value),
)
const danglingExits = computed(() =>
  visibleExits.value.filter(
    (e) => !regionRoomIds.value.has(Number(e.target_room)),
  ),
)

function exitStatus(e: ExitRow): 'ok' | 'self_loop' | 'invalid' {
  if (!regionRoomIds.value.has(Number(e.target_room))) return 'invalid'
  if (Number(e.target_room) === roomId.value) return 'self_loop'
  return 'ok'
}

function roomNameFor(targetRoomId: number): string | null {
  const rows = roomData.value?.rows ?? []
  const r = rows.find(
    (x) => String(x.region_id) === regionId.value && Number(x.room_id) === targetRoomId,
  ) as RoomRow | undefined
  return r?.name ?? null
}

const terrainsInWorld = computed<TerrainRow[]>(() => {
  return terrainsData.value?.rows ?? []
})

const palette = computed(() => {
  const m = new Map<string, TerrainRow>()
  for (const t of terrainsInWorld.value) m.set(t.symbol, t)
  return m
})

const draft = reactive({
  name: '',
  description: '',
  terrain: '' as string,
  width: 0,
  height: 0,
  layout: [] as string[],
  spawn_x: 0,
  spawn_y: 0,
  extra_json: '{}',
  zone_id: 0,
})
const scripts = ref<ScriptRef>({ on_enter: null, on_exit: null, on_pulse: null })

watchEffect(() => {
  if (!room.value) return
  draft.name = room.value.name ?? ''
  draft.description = room.value.description ?? ''
  draft.terrain = room.value.terrain ?? ''
  draft.width = room.value.width ?? 0
  draft.height = room.value.height ?? 0
  try {
    const parsed = JSON.parse(room.value.layout_json ?? '[]')
    draft.layout = Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    draft.layout = []
  }
  draft.spawn_x = room.value.spawn_x ?? 0
  draft.spawn_y = room.value.spawn_y ?? 0
  draft.extra_json = room.value.extra_json ?? '{}'
  draft.zone_id = room.value.zone_id ?? 0
  try {
    const s = JSON.parse(room.value.scripts_json ?? '{}')
    scripts.value = {
      on_enter: s.on_enter ?? null,
      on_exit: s.on_exit ?? null,
      on_pulse: s.on_pulse ?? s.pulse ?? null,
    }
  } catch {
    scripts.value = { on_enter: null, on_exit: null, on_pulse: null }
  }
})

const layoutText = computed({
  get: () => draft.layout.join('\n'),
  set: (v: string) => {
    const rows = v.split('\n').filter((l) => l.length > 0)
    draft.layout = rows
  },
})

function padRow(row: string, width: number): string {
  if (row.length === width) return row
  if (row.length > width) return row.slice(0, width)
  return row + '.'.repeat(width - row.length)
}

function ensureLayoutSize() {
  const w = Math.max(0, Math.floor(draft.width ?? 0))
  const h = Math.max(0, Math.floor(draft.height ?? 0))
  if (h === 0 && draft.layout.length > 0) {
    draft.layout = draft.layout.map((r) => padRow(r, w))
    return
  }
  if (draft.layout.length > h) {
    draft.layout = draft.layout.slice(0, h)
  } else {
    while (draft.layout.length < h) {
      draft.layout.push('.'.repeat(w))
    }
  }
  draft.layout = draft.layout.map((r) => padRow(r, w))
}

watch(() => draft.height, ensureLayoutSize)
watch(() => draft.width, ensureLayoutSize)

function extendDown(by = 1) {
  const w = Math.max(0, Math.floor(draft.width ?? 0))
  const fill = draft.terrain && draft.terrain !== ' ' ? draft.terrain.repeat(w) : '.'.repeat(w)
  for (let i = 0; i < by; i++) draft.layout.push(fill)
  draft.height = draft.layout.length
}

function fillAll() {
  const w = Math.max(0, Math.floor(draft.width ?? 0))
  const ch = draft.terrain && draft.terrain !== ' ' ? draft.terrain : '.'
  draft.layout = Array.from({ length: Math.max(draft.layout.length, draft.height) }, () => ch.repeat(w))
}

function onIdentityEnter(field: 'width' | 'height') {
  if (field === 'height') {
    draft.height = (draft.height ?? 0) + 1
  } else {
    extendDown(1)
  }
}

const exits = ref<ExitRow[]>([])
watchEffect(() => {
  if (!exitsData.value) return
  exits.value = (exitsData.value.rows as Array<Record<string, unknown>>)
    .filter(
      (e) =>
        String(e.region_id) === regionId.value &&
        Number(e.from_room_id) === roomId.value,
    )
    .map((e) => ({
      id: Number(e.id),
      direction: String(e.direction),
      target_room: Number(e.to_room_id),
      _targetRoomInput: String(e.to_room_id),
      dest_x: Number(e.dest_x ?? -1),
      dest_y: Number(e.dest_y ?? -1),
      is_portal: Boolean(e.is_portal),
      portal_name: String(e.portal_name ?? ''),
      auto_trigger: Boolean(e.auto_trigger ?? true),
      is_one_way: Boolean(e.is_one_way),
    }))
})

const OPPOSITE_DIR: Record<string, string> = {
  north: 'south', south: 'north',
  east: 'west',   west: 'east',
  up: 'down',     down: 'up',
}

function addExit() {
  exits.value.push({
    direction: 'north',
    target_room: 0,
    _targetRoomInput: '',
    dest_x: -1,
    dest_y: -1,
    is_portal: false,
    portal_name: '',
    auto_trigger: true,
    is_one_way: false,
    _isNew: true,
  })
}

function syncExitTargetRooms() {
  for (const e of exits.value) {
    if (e._targetRoomInput === undefined) continue
    const resolved = resolveWikiId(e._targetRoomInput)
    const n = Number(resolved)
    if (Number.isInteger(n) && n >= 0) e.target_room = n
  }
}

function removeExit(idx: number) {
  const e = exits.value[idx]
  if (!e) return
  if (e._isNew) exits.value.splice(idx, 1)
  else exits.value[idx] = { ...e, _deleted: true }
}

const { data: graphData } = await useFetch<{ rooms: GraphRoom[]; exits: GraphExit[] }>(
  () => `/api/rooms/graph?region_id=${encodeURIComponent(regionId.value)}`,
)

const MAP_NODE_W = 110
const MAP_NODE_H = 38
const MAP_PADDING = 24

const mapLayout = computed(() => {
  const rooms = graphData.value?.rooms ?? []
  const exits = graphData.value?.exits ?? []
  return computeGraphLayout(rooms, exits)
})

const mapViewBox = computed(() => computeGraphViewBox(mapLayout.value, MAP_NODE_W, MAP_NODE_H, MAP_PADDING))

function mapNodePos(node: ReturnType<typeof mapLayout.value[number]>) {
  return {
    cx: mapViewBox.value.ox + (node.x + 0.5) * MAP_NODE_W,
    cy: mapViewBox.value.oy + (node.y + 0.5) * MAP_NODE_H,
  }
}

const mapEdges = computed(() => graphEdges(mapLayout.value, graphData.value?.exits ?? []))

const currentLayoutNode = computed(() => mapLayout.value.find((n) => n.room.room_id === roomId.value))

const neighborInfo = computed(() => {
  const node = currentLayoutNode.value
  if (!node) return { incoming: [], outgoing: [] } as {
    incoming: GraphExit[]
    outgoing: GraphExit[]
  }
  const exits = graphData.value?.exits ?? []
  return {
    incoming: exits.filter((e) => e.to_room_id === roomId.value),
    outgoing: exits.filter((e) => e.from_room_id === roomId.value),
  }
})

const currentSpawns = computed(() => spawns.value.filter((s) => !s._deleted))

function spawnColor(type: string): string {
  switch (type) {
    case 'mob': return '#ef4444'
    case 'npc': return '#06b6d4'
    case 'item': return '#eab308'
    case 'interactable': return '#a855f7'
    default: return '#a3a3a3'
  }
}

const spawns = ref<SpawnRow[]>([])
watchEffect(() => {
  if (!spawnsData.value) return
  spawns.value = (spawnsData.value.rows as Array<Record<string, unknown>>)
    .filter(
      (s) =>
        String(s.region_id) === regionId.value &&
        Number(s.room_id) === roomId.value,
    )
    .map((s) => ({
      id: Number(s.id),
      x: Number(s.x),
      y: Number(s.y),
      type: String(s.type),
      template_id: String(s.template_id),
      respawn_time: Number(s.respawn_time ?? 30),
      is_respawning: Boolean(s.is_respawning ?? true),
      override_json: String(s.override_json ?? ''),
    }))
})

function addSpawn() {
  spawns.value.push({
    x: 0,
    y: 0,
    type: 'mob',
    template_id: '',
    respawn_time: 30,
    is_respawning: true,
    override_json: '',
    _isNew: true,
  })
}

function removeSpawn(idx: number) {
  const s = spawns.value[idx]
  if (!s) return
  if (s._isNew) spawns.value.splice(idx, 1)
  else spawns.value[idx] = { ...s, _deleted: true }
}

const tab = ref<'identity' | 'layout' | 'map' | 'exits' | 'spawns' | 'scripts' | 'raw'>('identity')

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

async function save() {
  if (!room.value) return
  syncExitTargetRooms()
  if (danglingExits.value.length) {
    const list = danglingExits.value
      .map((e) => `${e.direction} → #${e.target_room}`)
      .join(', ')
    error.value = `Exits target rooms that don't exist in ${regionId.value}: ${list}. Pick valid room ids first.`
    tab.value = 'exits'
    return
  }
  if (selfLoopExits.value.length) {
    const list = selfLoopExits.value
      .map((e) => `${e.direction} → #${e.target_room}`)
      .join(', ')
    error.value = `Exits target the room itself: ${list}. Self-loops are not allowed.`
    tab.value = 'exits'
    return
  }
  saving.value = true
  error.value = null
  success.value = null
  try {
    syncExitTargetRooms()
    const key = `${room.value.region_id}::${room.value.room_id}`
    await $fetch(`/api/tables/world_rooms/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: {
        name: draft.name,
        description: draft.description,
        terrain: draft.terrain || null,
        width: draft.width,
        height: draft.height,
        layout_json: JSON.stringify(draft.layout),
        spawn_x: draft.spawn_x,
        spawn_y: draft.spawn_y,
        scripts_json: JSON.stringify(scripts.value),
        extra_json: draft.extra_json,
        zone_id: draft.zone_id,
      },
    })

    for (const e of exits.value.filter((x) => x._deleted)) {
      if (e.id) {
        await $fetch(`/api/tables/world_room_exits/${e.id}`, { method: 'DELETE' })
      }
    }
    for (const e of exits.value.filter((x) => !x._deleted && x._isNew)) {
      await $fetch(`/api/tables/world_room_exits`, {
        method: 'POST',
        body: {
          region_id: regionId.value,
          from_room_id: roomId.value,
          direction: e.direction,
          to_room_id: e.target_room,
          dest_x: e.dest_x,
          dest_y: e.dest_y,
          is_portal: e.is_portal ? 1 : 0,
          portal_name: e.portal_name,
          auto_trigger: e.auto_trigger ? 1 : 0,
          is_one_way: e.is_one_way ? 1 : 0,
        },
      })
    }
    for (const e of exits.value.filter((x) => !x._deleted && !x._isNew)) {
      if (!e.id) continue
      await $fetch(`/api/tables/world_room_exits/${e.id}`, {
        method: 'PUT',
        body: {
          direction: e.direction,
          to_room_id: e.target_room,
          dest_x: e.dest_x,
          dest_y: e.dest_y,
          is_portal: e.is_portal ? 1 : 0,
          portal_name: e.portal_name,
          auto_trigger: e.auto_trigger ? 1 : 0,
          is_one_way: e.is_one_way ? 1 : 0,
        },
      })
    }

    const newForwards = exits.value.filter((x) => !x._deleted && x._isNew && !x.is_one_way)
    if (newForwards.length) {
      const latest = await $fetch<{ rows: Array<{ from_room_id: number; direction: string; to_room_id: number }> }>(
        `/api/tables/world_room_exits`,
        { query: { q: JSON.stringify({ region_id: regionId.value }), limit: 1000 } },
      )
      for (const f of newForwards) {
        const ret = OPPOSITE_DIR[f.direction]
        if (!ret) continue
        if (Number(f.target_room) === roomId.value) continue
        const exists = latest.rows.some(
          (r) =>
            Number(r.from_room_id) === Number(f.target_room) &&
            String(r.direction) === ret &&
            Number(r.to_room_id) === roomId.value,
        )
        if (exists) continue
        try {
          await $fetch(`/api/tables/world_room_exits`, {
            method: 'POST',
            body: {
              region_id: regionId.value,
              from_room_id: Number(f.target_room),
              direction: ret,
              to_room_id: roomId.value,
              dest_x: room.value?.spawn_x ?? -1,
              dest_y: room.value?.spawn_y ?? -1,
              is_portal: 0,
              portal_name: '',
              auto_trigger: 1,
              is_one_way: 0,
            },
          })
        } catch {
        }
      }
    }

    for (const s of spawns.value.filter((x) => x._deleted)) {
      if (s.id) {
        await $fetch(`/api/tables/world_room_spawns/${s.id}`, { method: 'DELETE' })
      }
    }
    for (const s of spawns.value.filter((x) => !x._deleted && x._isNew)) {
      await $fetch(`/api/tables/world_room_spawns`, {
        method: 'POST',
        body: {
          region_id: regionId.value,
          room_id: roomId.value,
          x: s.x,
          y: s.y,
          type: s.type,
          template_id: resolveWikiId(s.template_id),
          respawn_time: s.respawn_time,
          is_respawning: s.is_respawning ? 1 : 0,
          override_json: s.override_json || null,
        },
      })
    }
    for (const s of spawns.value.filter((x) => !x._deleted && !x._isNew)) {
      if (!s.id) continue
      await $fetch(`/api/tables/world_room_spawns/${s.id}`, {
        method: 'PUT',
        body: {
          x: s.x,
          y: s.y,
          type: s.type,
          template_id: resolveWikiId(s.template_id),
          respawn_time: s.respawn_time,
          is_respawning: s.is_respawning ? 1 : 0,
          override_json: s.override_json || null,
        },
      })
    }

    success.value = 'Saved.'
    await refreshRoom()
    await refreshExits()
    await refreshSpawns()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Save failed'
  } finally {
    saving.value = false
  }
}

const recognizedSymbols = computed(() => new Set(palette.value.keys()))
const unrecognizedInLayout = computed(() => {
  const used = new Set<string>()
  for (const row of draft.layout) for (const c of row) if (c !== ' ') used.add(c)
  return [...used].filter((c) => !recognizedSymbols.value.has(c))
})
</script>

<template>
  <div v-if="!room" class="text-neutral-400">Room not found.</div>
  <div v-else class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <button class="text-sky-400 hover:underline text-sm" @click="emit('close')">← back</button>
        <h2 class="text-xl font-semibold font-mono">#{{ room.room_id }} {{ room.name }}</h2>
        <span class="text-neutral-500 text-sm">{{ regionId }}</span>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save all' }}
      </button>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div class="border-b border-neutral-800 flex gap-1">
      <button v-for="t in ['identity','layout','map','exits','spawns','scripts','raw'] as const" :key="t" class="px-3 py-1.5 text-sm rounded-t" :class="tab===t ? 'bg-neutral-900 text-neutral-100 border border-neutral-800 border-b-0' : 'text-neutral-400 hover:text-neutral-200'" @click="tab=t">
        {{ t }}
      </button>
    </div>

    <div v-if="tab==='identity'" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <div>
        <label class="block text-sm text-neutral-400 mb-1">name</label>
        <input v-model="draft.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
      </div>
      <div>
        <AdminWikiText v-model="draft.description" :rows="4" />
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-sm text-neutral-400 mb-1">default terrain</label>
          <select v-model="draft.terrain" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
            <option value="">— none —</option>
            <option v-for="t in terrainsInWorld" :key="t.symbol" :value="t.symbol">{{ t.symbol }} {{ t.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-neutral-400 mb-1">width</label>
          <input
            v-model.number="draft.width"
            type="number"
            min="0"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
            @keydown.enter.prevent="extendDown(1)"
          />
        </div>
        <div>
          <label class="block text-sm text-neutral-400 mb-1">height</label>
          <input
            v-model.number="draft.height"
            type="number"
            min="0"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
            @keydown.enter.prevent="onIdentityEnter('height')"
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-neutral-400 mb-1">spawn_x</label>
          <input v-model.number="draft.spawn_x" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </div>
        <div>
          <label class="block text-sm text-neutral-400 mb-1">spawn_y</label>
          <input v-model.number="draft.spawn_y" type="number" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </div>
      </div>
      <div>
        <label class="block text-sm text-neutral-400 mb-1">
          zone
          <span class="text-xs text-neutral-500">— partition of this region</span>
        </label>
        <select v-model.number="draft.zone_id" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
          <option :value="0">0 — (no zone)</option>
          <option v-for="z in zonesInRegion" :key="z.zone_id" :value="z.zone_id">
            #{{ z.zone_id }} — {{ z.name }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="tab==='layout'" class="space-y-4">
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Layout editor</h3>
          <div class="text-xs text-neutral-400">Width × Height = {{ draft.width }}×{{ draft.height }}. Each char = one tile. Spaces = void.</div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button
            class="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
            :disabled="!draft.layout.length"
            @click="extendDown(1)"
            title="Add one row to the bottom (Enter in width/height does the same)"
          >+ row</button>
          <button
            class="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
            :disabled="!draft.layout.length || !draft.terrain"
            :title="draft.terrain ? `Replace every cell with '${draft.terrain}'` : 'Pick a default terrain first'"
            @click="fillAll"
          >fill all with "{{ draft.terrain || '·' }}"</button>
          <span class="text-xs text-neutral-500">·</span>
          <NuxtLink
            to="/world/terrains"
            class="text-xs text-sky-400 hover:underline"
            title="Add or edit tiles"
          >+ add tile to palette ↗</NuxtLink>
        </div>
        <AdminLayoutPainter
          :layout="draft.layout"
          :terrain="terrainsInWorld"
          :width="draft.width"
          :height="draft.height"
          :spawns="currentSpawns"
          @update:layout="(rows) => draft.layout = rows"
        />
        <div v-if="unrecognizedInLayout.length" class="text-xs text-amber-400">
          Unrecognized symbols: {{ unrecognizedInLayout.join(' ') }} — add them in <NuxtLink to="/world/terrains" class="underline">Palette</NuxtLink>.
        </div>
      </div>
    </div>

    <div v-if="tab==='map'" class="space-y-4">
      <div class="bg-neutral-900 border border-neutral-800 rounded p-3 flex items-center justify-between">
        <div class="text-sm text-neutral-400">
          <span class="text-neutral-200 font-medium">You are here.</span>
          {{ neighborInfo.outgoing.length }} exits out · {{ neighborInfo.incoming.length }} entries in · {{ currentSpawns.length }} spawns · {{ mapLayout.length }} rooms in region.
        </div>
        <a
          :href="`/world/regions/${encodeURIComponent(regionId)}/map`"
          target="_blank"
          class="text-sky-400 hover:underline text-sm"
        >
          open full region map ↗
        </a>
      </div>

      <div v-if="!mapLayout.length" class="bg-neutral-900 border border-neutral-800 rounded p-6 text-center text-neutral-500">
        No rooms in this region yet.
      </div>

      <div v-else class="bg-neutral-900 border border-neutral-800 rounded p-2 overflow-auto">
        <svg
          :viewBox="`0 0 ${mapViewBox.width} ${mapViewBox.height}`"
          :width="mapViewBox.width"
          :height="mapViewBox.height"
          xmlns="http://www.w3.org/2000/svg"
          style="background:#0a0a0a; max-width:100%; height:auto;"
        >
          <g>
            <line
              v-for="(edge, i) in mapEdges"
              :key="i"
              :x1="mapNodePos(edge.from).cx"
              :y1="mapNodePos(edge.from).cy"
              :x2="mapNodePos(edge.to).cx"
              :y2="mapNodePos(edge.to).cy"
              :stroke="edge.e.is_portal ? '#a855f7' : '#525252'"
              :stroke-dasharray="edge.e.is_one_way ? '4 3' : ''"
              stroke-width="1.5"
            />
          </g>
          <g>
            <template v-for="n in mapLayout" :key="n.room.room_id">
              <NuxtLink
                v-if="n.room.room_id !== roomId"
                :to="`/world_rooms/${encodeURIComponent(encodeCompositeKey('world_rooms', { region_id: n.room.region_id, room_id: n.room.room_id } as Record<string, unknown>))}`"
              >
                <rect
                  :x="mapViewBox.ox + n.x * MAP_NODE_W + 3"
                  :y="mapViewBox.oy + n.y * MAP_NODE_H + 3"
                  :width="MAP_NODE_W - 6"
                  :height="MAP_NODE_H - 6"
                  rx="5"
                  fill="#171717"
                  stroke="#3f3f46"
                  stroke-width="1"
                />
                <text
                  :x="mapViewBox.ox + n.x * MAP_NODE_W + MAP_NODE_W / 2"
                  :y="mapViewBox.oy + n.y * MAP_NODE_H + 16"
                  text-anchor="middle"
                  fill="#d4d4d8"
                  font-family="ui-monospace, monospace"
                  font-size="11"
                >
                  #{{ n.room.room_id }} {{ n.room.name.length > 12 ? n.room.name.slice(0, 11) + '…' : n.room.name }}
                </text>
                <text
                  :x="mapViewBox.ox + n.x * MAP_NODE_W + MAP_NODE_W / 2"
                  :y="mapViewBox.oy + n.y * MAP_NODE_H + 30"
                  text-anchor="middle"
                  fill="#71717a"
                  font-family="ui-monospace, monospace"
                  font-size="9"
                >
                  {{ n.room.width }}×{{ n.room.height }}
                </text>
              </NuxtLink>
            </template>
            <g v-if="currentLayoutNode">
              <rect
                :x="mapViewBox.ox + currentLayoutNode.x * MAP_NODE_W + 3"
                :y="mapViewBox.oy + currentLayoutNode.y * MAP_NODE_H + 3"
                :width="MAP_NODE_W - 6"
                :height="MAP_NODE_H - 6"
                rx="5"
                fill="#064e3b"
                stroke="#10b981"
                stroke-width="2"
              />
              <text
                :x="mapViewBox.ox + currentLayoutNode.x * MAP_NODE_W + MAP_NODE_W / 2"
                :y="mapViewBox.oy + currentLayoutNode.y * MAP_NODE_H + 16"
                text-anchor="middle"
                fill="#ecfdf5"
                font-family="ui-monospace, monospace"
                font-size="11"
                font-weight="600"
              >
                #{{ currentLayoutNode.room.room_id }} {{ currentLayoutNode.room.name.length > 12 ? currentLayoutNode.room.name.slice(0, 11) + '…' : currentLayoutNode.room.name }}
              </text>
              <text
                :x="mapViewBox.ox + currentLayoutNode.x * MAP_NODE_W + MAP_NODE_W / 2"
                :y="mapViewBox.oy + currentLayoutNode.y * MAP_NODE_H + 30"
                text-anchor="middle"
                fill="#a7f3d0"
                font-family="ui-monospace, monospace"
                font-size="9"
              >
                ← you are here
              </text>
              <title>{{ spawns.filter((s) => !s._deleted).length }} spawns · {{ currentLayoutNode.room.width }}×{{ currentLayoutNode.room.height }} cells</title>
              <g v-for="s in currentSpawns" :key="`sp-${s.id ?? Math.random()}`">
                <circle
                  :cx="mapViewBox.ox + currentLayoutNode.x * MAP_NODE_W + 10 + (s.x / Math.max(currentLayoutNode.room.width ?? 1, 1)) * (MAP_NODE_W - 20)"
                  :cy="mapViewBox.oy + currentLayoutNode.y * MAP_NODE_H + 10 + (s.y / Math.max(currentLayoutNode.room.height ?? 1, 1)) * (MAP_NODE_H - 20)"
                  :r="4"
                  :fill="spawnColor(s.type)"
                  stroke="#0a0a0a"
                  stroke-width="1"
                >
                  <title>{{ s.type }} · {{ s.template_id }} · ({{ s.x }},{{ s.y }}) · respawn {{ s.respawn_time }}s</title>
                </circle>
                <text
                  :x="mapViewBox.ox + currentLayoutNode.x * MAP_NODE_W + 10 + (s.x / Math.max(currentLayoutNode.room.width ?? 1, 1)) * (MAP_NODE_W - 20)"
                  :y="mapViewBox.oy + currentLayoutNode.y * MAP_NODE_H + 10 + (s.y / Math.max(currentLayoutNode.room.height ?? 1, 1)) * (MAP_NODE_H - 20) + 3"
                  text-anchor="middle"
                  fill="#fff"
                  font-family="ui-monospace, monospace"
                  font-size="8"
                  font-weight="700"
                  style="pointer-events:none"
                >{{ s.type[0]?.toUpperCase() }}</text>
              </g>
            </g>
          </g>
        </svg>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
          <h3 class="text-xs uppercase tracking-wide text-neutral-500 mb-2">Exits from this room ({{ neighborInfo.outgoing.length }})</h3>
          <ul class="text-sm font-mono space-y-1">
            <li v-for="e in neighborInfo.outgoing" :key="`o-${e.id}`">
              <span class="text-emerald-400">{{ e.direction }}</span>
              → #{{ e.to_room_id }}
              <span v-if="e.is_portal" class="text-purple-400 ml-1">[portal: {{ e.portal_name }}]</span>
              <span v-if="e.is_one_way" class="text-neutral-500 ml-1">(one-way)</span>
            </li>
            <li v-if="!neighborInfo.outgoing.length" class="text-neutral-500">— none —</li>
          </ul>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
          <h3 class="text-xs uppercase tracking-wide text-neutral-500 mb-2">Entries into this room ({{ neighborInfo.incoming.length }})</h3>
          <ul class="text-sm font-mono space-y-1">
            <li v-for="e in neighborInfo.incoming" :key="`i-${e.id}`">
              ← #{{ e.from_room_id }} <span class="text-sky-400">{{ e.direction }}</span>
              <span v-if="e.is_portal" class="text-purple-400 ml-1">[portal: {{ e.portal_name }}]</span>
              <span v-if="e.is_one_way" class="text-neutral-500 ml-1">(one-way)</span>
            </li>
            <li v-if="!neighborInfo.incoming.length" class="text-neutral-500">— none —</li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="tab==='exits'" class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold">Exits</h3>
        <button class="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded" @click="addExit">+ Add exit</button>
      </div>

      <div v-if="danglingExits.length || selfLoopExits.length" class="mb-3 px-3 py-2 rounded text-sm bg-amber-900/30 border border-amber-700 text-amber-200">
        <div v-if="danglingExits.length">
          {{ danglingExits.length }} exit(s) target rooms that don't exist in
          <span class="font-mono">{{ regionId }}</span>. Pick a room id from the list, or create the target room first.
        </div>
        <div v-if="selfLoopExits.length" :class="danglingExits.length ? 'mt-1' : ''">
          {{ selfLoopExits.length }} exit(s) point back at this room. Self-loops are not allowed.
        </div>
      </div>

      <table class="w-full text-sm">
        <thead class="text-left text-neutral-500 text-xs">
          <tr>
            <th class="px-2 py-1">direction</th>
            <th class="px-2 py-1">target room</th>
            <th class="px-2 py-1 w-20">dest x</th>
            <th class="px-2 py-1 w-20">dest y</th>
            <th class="px-2 py-1">flags</th>
            <th class="px-2 py-1 w-24"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(e, i) in exits" >
            <tr v-if="!e._deleted" :key="e.id ?? `new-${i}`" class="border-t border-neutral-800">
              <td class="px-2 py-1">
                <select v-model="e.direction" class="bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono">
                  <option v-for="d in ['north','south','east','west','up','down']" :key="d" :value="d">{{ d }}</option>
                </select>
              </td>
              <td class="px-2 py-1">
                <div class="flex items-center gap-2">
                  <AdminWikiIdInput v-model="e._targetRoomInput" placeholder="target room" />
                  <span
                    v-if="exitStatus(e) === 'invalid'"
                    class="text-xs text-red-400 font-mono whitespace-nowrap"
                    :title="`No room #${e.target_room} in ${regionId}`"
                  >no such room</span>
                  <span
                    v-else-if="exitStatus(e) === 'self_loop'"
                    class="text-xs text-amber-400 font-mono whitespace-nowrap"
                  >self-loop</span>
                  <span v-else-if="roomNameFor(Number(e.target_room))" class="text-xs text-neutral-500 font-mono whitespace-nowrap truncate max-w-[14rem]">
                    → {{ roomNameFor(Number(e.target_room)) }}
                  </span>
                </div>
              </td>
              <td class="px-2 py-1"><input v-model.number="e.dest_x" type="number" class="w-16 bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
              <td class="px-2 py-1"><input v-model.number="e.dest_y" type="number" class="w-16 bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
              <td class="px-2 py-1">
                <label class="text-xs flex items-center gap-2"><input type="checkbox" v-model="e.is_portal" />portal</label>
                <label class="text-xs flex items-center gap-2"><input type="checkbox" v-model="e.is_one_way" />one-way</label>
                <label class="text-xs flex items-center gap-2"><input type="checkbox" v-model="e.auto_trigger" />auto</label>
              </td>
              <td class="px-2 py-1 text-right"><button class="text-red-400 hover:underline text-xs" @click="removeExit(exits.indexOf(e))">remove</button></td>
            </tr>
          </template>
          <tr v-if="!exits.filter((x)=>!x._deleted).length">
            <td colspan="6" class="px-2 py-3 text-center text-neutral-500">No exits.</td>
          </tr>
        </tbody>
      </table>

      <details v-if="regionRoomIds.size" class="mt-3 text-xs text-neutral-400">
        <summary class="cursor-pointer">rooms in {{ regionId }} ({{ regionRoomIds.size }})</summary>
        <div class="font-mono mt-1 break-all text-neutral-500">
          <span v-for="id in [...regionRoomIds].sort((a, b) => a - b)" :key="id" class="mr-2">#{{ id }}</span>
        </div>
      </details>
    </div>

    <div v-if="tab==='spawns'" class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold">Spawns</h3>
        <button class="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded" @click="addSpawn">+ Add spawn</button>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-neutral-500 text-xs">
          <tr>
            <th class="px-2 py-1 w-12">x</th>
            <th class="px-2 py-1 w-12">y</th>
            <th class="px-2 py-1">type</th>
            <th class="px-2 py-1">template_id</th>
            <th class="px-2 py-1 w-24">respawn</th>
            <th class="px-2 py-1 w-16">live</th>
            <th class="px-2 py-1 w-24"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in spawns.filter((x)=>!x._deleted)" :key="s.id ?? `new-${i}`" class="border-t border-neutral-800">
            <td class="px-2 py-1"><input v-model.number="s.x" type="number" class="w-14 bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
            <td class="px-2 py-1"><input v-model.number="s.y" type="number" class="w-14 bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
            <td class="px-2 py-1">
              <select v-model="s.type" class="bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono">
                <option v-for="t in ['mob','item','interactable','npc']" :key="t" :value="t">{{ t }}</option>
              </select>
            </td>
            <td class="px-2 py-1">
              <AdminWikiIdInput v-model="s.template_id" :placeholder="s.type === 'mob' || s.type === 'npc' ? 'mob or npc name' : 'template_id'" />
            </td>
            <td class="px-2 py-1"><input v-model.number="s.respawn_time" type="number" step="0.5" class="w-20 bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
            <td class="px-2 py-1"><input type="checkbox" v-model="s.is_respawning" /></td>
            <td class="px-2 py-1 text-right"><button class="text-red-400 hover:underline text-xs" @click="removeSpawn(spawns.indexOf(s))">remove</button></td>
          </tr>
          <tr v-if="!spawns.filter((x)=>!x._deleted).length">
            <td colspan="7" class="px-2 py-3 text-center text-neutral-500">No spawns.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab==='scripts'" class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <ScriptPicker v-model="scripts" type="room" />
    </div>

    <div v-if="tab==='raw'" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3 text-sm">
      <div>
        <label class="block text-neutral-400 mb-1">layout_json</label>
        <textarea :value="JSON.stringify(draft.layout, null, 2)" @input="draft.layout = JSON.parse(($event.target as HTMLTextAreaElement).value)" rows="6" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" />
      </div>
      <div>
        <label class="block text-neutral-400 mb-1">scripts_json</label>
        <textarea :value="JSON.stringify(scripts, null, 2)" @input="scripts = JSON.parse(($event.target as HTMLTextAreaElement).value)" rows="4" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" />
      </div>
      <div>
        <label class="block text-neutral-400 mb-1">extra_json</label>
        <textarea v-model="draft.extra_json" rows="4" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono" />
      </div>
    </div>
  </div>
</template>
