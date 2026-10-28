<script setup lang="ts">
const props = defineProps<{
  regionId?: string
  regionName?: string
}>()

const emit = defineEmits<{
  (e: 'created', room: { region_id: string; room_id: number; name: string }): void
  (e: 'close'): void
}>()

interface RegionRow {
  id: string
  name: string | null
}

const open = ref(true)

const regionsData = ref<RegionRow[]>([])
const regionsLoaded = ref(false)

const selectedRegionId = ref<string>(props.regionId ?? '')

watch(
  () => props.regionId,
  (val) => {
    if (val) selectedRegionId.value = val
  },
)

onMounted(async () => {
  try {
    const res = await $fetch<{ rows: Array<{ entity_id: string; doc: { name?: string } }> }>('/api/entities/region', { query: { limit: 500 } })
    regionsData.value = (res.rows ?? []).map((r) => ({ id: r.entity_id, name: String(r.doc.name ?? '') }))
  } catch {
    regionsData.value = []
  } finally {
    regionsLoaded.value = true
    if (!selectedRegionId.value && regionsData.value.length) {
      selectedRegionId.value = regionsData.value[0]!.id
    }
  }
})

const selectedRegionName = computed<string | null>(() => {
  const r = regionsData.value.find((x) => x.id === selectedRegionId.value)
  return r?.name ?? null
})

const showDropdown = computed(() => !props.regionId)

const name = ref('')
const description = ref('')
const terrain = ref('')
const width = ref<number>(10)
const height = ref<number>(8)
const layoutJson = ref<string>('[]')
const creating = ref(false)
const error = ref<string | null>(null)
const assignedRoomId = ref<number | null>(null)
const assignedRoomKey = computed(() =>
  assignedRoomId.value !== null && selectedRegionId.value
    ? encodeURIComponent(`${selectedRegionId.value}::${assignedRoomId.value}`)
    : null,
)

function close() {
  open.value = false
  emit('close')
}

async function submit() {
  if (!selectedRegionId.value) {
    error.value = 'Pick a region first.'
    return
  }
  if (!name.value.trim()) {
    error.value = 'Name is required'
    return
  }
  try {
    creating.value = true
    error.value = null
    assignedRoomId.value = null
    const suggested = await $fetch<{ suggested_room_id: number }>(
      '/api/rooms/next-free-id',
      { query: { region_id: selectedRegionId.value } },
    )
    const newId = Number(suggested.suggested_room_id)
    if (!Number.isSafeInteger(newId) || newId <= 0) {
      throw new Error('Could not determine the next free room id')
    }
    await $fetch('/api/entities/room', {
      method: 'POST',
      body: {
        id: `${selectedRegionId.value}::${newId}`,
        doc: {
          region_id: selectedRegionId.value,
          room_id: newId,
          name: name.value.trim(),
          description: description.value || '',
          width: width.value,
          height: height.value,
          layout: JSON.parse(layoutJson.value),
          spawn_x: 0,
          spawn_y: 0,
          zone_id: 0,
          scripts: {},
          exits: {},
          spawns: [],
        },
      },
    })
    assignedRoomId.value = newId
    emit('created', { region_id: selectedRegionId.value, room_id: newId, name: name.value.trim() })
  } catch (e: unknown) {
    const err = e as {
      statusCode?: number
      statusMessage?: string
      message?: string
      data?: { statusMessage?: string; data?: { hint?: string } }
    }
    if (err?.statusCode === 409) {
      error.value = err.data?.data?.hint ?? 'That room already exists.'
    } else {
      error.value = err.data?.statusMessage ?? err.statusMessage ?? err.message ?? 'Create failed'
    }
  } finally {
    creating.value = false
  }
}

function fillSampleLayout() {
  const w = width.value
  const h = height.value
  const grid = Array.from({ length: h }, () => '.'.repeat(w))
  layoutJson.value = JSON.stringify(grid, null, 0)
}

function createAnother() {
  assignedRoomId.value = null
  name.value = ''
  description.value = ''
  terrain.value = ''
  width.value = 10
  height.value = 8
  layoutJson.value = '[]'
  error.value = null
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/60 flex items-start justify-center p-6 overflow-auto" @click.self="close">
    <div class="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-2xl shadow-xl">
      <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h3 class="text-base font-semibold">
          <template v-if="!showDropdown">
            Add room to
            <span class="font-mono text-sky-300">{{ props.regionId }}</span>
            <span v-if="props.regionName" class="text-neutral-400 font-normal">— {{ props.regionName }}</span>
          </template>
          <template v-else>Add room</template>
        </h3>
        <button class="text-neutral-400 hover:text-white" aria-label="Close" @click="close">×</button>
      </div>

      <div class="p-4 space-y-3">
        <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>

        <div v-if="assignedRoomId !== null" class="bg-emerald-900/30 border border-emerald-700 rounded px-3 py-3 text-sm text-emerald-200 space-y-2">
          <div>
            Created room
            <span class="font-mono text-emerald-300">#{{ assignedRoomId }}</span>
            <span v-if="name" class="text-emerald-400">— {{ name }}</span>
            <span v-if="selectedRegionName" class="text-emerald-400"> — {{ selectedRegionName }}</span>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <NuxtLink
              v-if="assignedRoomKey"
              :to="`/world_rooms/${assignedRoomKey}`"
              class="text-sky-400 hover:underline"
            >Open in editor ↗</NuxtLink>
            <button class="text-sky-400 hover:underline" @click="createAnother">+ add another</button>
          </div>
        </div>

        <template v-else>
          <label v-if="showDropdown" class="block text-sm">
            <span class="block text-neutral-400 mb-1">region</span>
            <select v-model="selectedRegionId" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1">
              <option v-if="!regionsLoaded" value="">(loading…)</option>
              <option v-else-if="!regionsData.length" value="">— no regions yet —</option>
              <option v-for="r in regionsData" :key="r.id" :value="r.id">
                {{ r.id }}{{ r.name ? ' — ' + r.name : '' }}
              </option>
            </select>
          </label>

          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">name</span>
            <input v-model="name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
          </label>

          <div class="bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-400">
            room_id will be assigned automatically (next free id for this region from
            <span class="font-mono text-neutral-300">world.entities</span>).
          </div>

          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">description</span>
            <textarea v-model="description" rows="2" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
          </label>

          <div class="grid grid-cols-3 gap-3">
            <label class="block text-sm">
              <span class="block text-neutral-400 mb-1">terrain</span>
              <input v-model="terrain" placeholder="e.g. grass" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
            </label>
            <label class="block text-sm">
              <span class="block text-neutral-400 mb-1">width</span>
              <input v-model.number="width" type="number" min="1" max="200" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
            </label>
            <label class="block text-sm">
              <span class="block text-neutral-400 mb-1">height</span>
              <input v-model.number="height" type="number" min="1" max="200" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
            </label>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="block text-neutral-400 text-sm">layout_json (array of <code>{{ width }}</code> char rows, {{ height }} rows)</span>
              <button class="text-xs text-sky-400 hover:underline" @click="fillSampleLayout">fill blank</button>
            </div>
            <textarea
              v-model="layoutJson"
              rows="6"
              class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
              spellcheck="false"
            />
          </div>
        </template>
      </div>

      <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-800">
        <button class="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-sm" @click="close">
          {{ assignedRoomId !== null ? 'Done' : 'Cancel' }}
        </button>
        <button
          v-if="assignedRoomId === null"
          class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50"
          :disabled="creating || !name.trim() || !selectedRegionId"
          @click="submit"
        >
          {{ creating ? 'Creating…' : 'Create room' }}
        </button>
      </div>
    </div>
  </div>
</template>