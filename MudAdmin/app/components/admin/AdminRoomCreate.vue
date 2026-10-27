<script setup lang="ts">
const emit = defineEmits<{ created: [id: string] }>()

const { data: regionsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { name?: string } }>
}>('/api/entities/region', { query: { limit: 500 } })

const { data: terrainsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { symbol?: string } }>
}>('/api/entities/terrain', { query: { limit: 500 } })

const regionId = ref('')
const name = ref('')
const description = ref('')
const terrain = ref('')
const width = ref(10)
const height = ref(8)

const suggestedRoomId = ref<number | null>(null)

const TERRAIN_SYMBOLS = computed(() =>
  (terrainsData.value?.rows ?? []).map((r) => String(r.doc.symbol ?? r.entity_id)).filter(Boolean),
)

watch(regionId, async (region) => {
  suggestedRoomId.value = null
  if (!region) return
  try {
    const res = await $fetch<{ suggested_room_id: number }>('/api/rooms/next-free-id', {
      query: { region_id: region },
    })
    suggestedRoomId.value = Number(res.suggested_room_id)
  } catch {
    suggestedRoomId.value = null
  }
})

const creating = ref(false)
const error = ref<string | null>(null)

function blankLayout(w: number, h: number): string[] {
  const cols = Math.min(Math.max(Math.trunc(w) || 10, 1), 200)
  const rows = Math.min(Math.max(Math.trunc(h) || 8, 1), 200)
  return Array.from({ length: rows }, () => '.'.repeat(cols))
}

async function create() {
  const region = regionId.value
  const nm = name.value.trim()
  if (!region || !nm) {
    error.value = 'region and name are required'
    return
  }
  creating.value = true
  error.value = null
  try {
    const res = await $fetch<{ suggested_room_id: number }>('/api/rooms/next-free-id', {
      query: { region_id: region },
    })
    const roomId = Number(res.suggested_room_id)
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      throw new Error('could not determine the next free room id')
    }
    const id = `${region}::${roomId}`
    await $fetch('/api/entities/room', {
      method: 'POST',
      body: {
        id,
        doc: {
          region_id: region,
          room_id: roomId,
          name: nm,
          description: description.value.trim(),
          terrain: terrain.value.trim() || null,
          width: Math.min(Math.max(Math.trunc(width.value) || 10, 1), 200),
          height: Math.min(Math.max(Math.trunc(height.value) || 8, 1), 200),
          layout: blankLayout(width.value, height.value),
          spawn_x: 0,
          spawn_y: 0,
          zone_id: 0,
          scripts: {},
          exits: {},
          spawns: [],
        },
      },
    })
    emit('created', id)
    await navigateTo(`/entities/room/${encodeURIComponent(id)}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    error.value = err.data?.statusMessage ?? err.message ?? 'Create failed'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
    <h3 class="text-sm font-semibold">New room</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">region</span>
        <select v-model="regionId" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
          <option value="">— pick a region —</option>
          <option v-for="r in regionsData?.rows ?? []" :key="r.entity_id" :value="r.entity_id">{{ r.entity_id }}{{ r.doc.name ? ' — ' + r.doc.name : '' }}</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">room_id (auto)</span>
        <input :value="regionId ? suggestedRoomId ?? '…' : ''" disabled class="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 font-mono text-sm opacity-60" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="name" placeholder="Entry Hall" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
      </label>
      <div class="flex items-end">
        <button
          class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50 w-full"
          :disabled="creating || !regionId || !name.trim()"
          @click="create"
        >
          {{ creating ? 'Creating…' : 'Create room' }}
        </button>
      </div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label class="text-sm md:col-span-2">
        <span class="block text-neutral-400 mb-1">description</span>
        <input v-model="description" placeholder="A dusty entrance." class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">terrain</span>
        <input v-model="terrain" list="room-create-terrains" placeholder="grass" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        <datalist id="room-create-terrains">
          <option v-for="t in TERRAIN_SYMBOLS" :key="t" :value="t" />
        </datalist>
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">width</span>
          <input v-model.number="width" type="number" min="1" max="200" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">height</span>
          <input v-model.number="height" type="number" min="1" max="200" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
        </label>
      </div>
    </div>
    <p class="text-xs text-neutral-500">room_id is the next free id for the region. Layout starts as a blank width × height grid — paint it in the editor.</p>
    <p v-if="error" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>
