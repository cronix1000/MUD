<script setup lang="ts">
import { encodeCompositeKey } from '~/utils/composite-key'

const props = defineProps<{
  regionId: string
  regionName?: string
}>()

const emit = defineEmits<{
  (e: 'created', room: { region_id: string; room_id: number; name: string }): void
  (e: 'close'): void
}>()

const open = ref(true)

const name = ref('')
const description = ref('')
const terrain = ref('')
const width = ref<number>(10)
const height = ref<number>(8)
const roomIdInput = ref<number | null>(null)
const fromRoomId = ref<number | null>(null)
const layoutJson = ref<string>('[]')
const loadingSuggestion = ref(true)
const suggestion = ref<{
  suggested_room_id: number
  reason: string
  used_room_ids: number[]
  upper_bound: number
} | null>(null)
const creating = ref(false)
const error = ref<string | null>(null)
const collision = ref<{ id: string; name: string | null } | null>(null)

async function loadSuggestion() {
  loadingSuggestion.value = true
  error.value = null
  collision.value = null
  try {
    const q = new URLSearchParams({ region_id: props.regionId })
    if (fromRoomId.value !== null) q.set('from_room_id', String(fromRoomId.value))
    suggestion.value = await $fetch(`/api/rooms/next-free-id?${q.toString()}`)
    if (roomIdInput.value === null) {
      roomIdInput.value = suggestion.value.suggested_room_id
    }
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Failed to compute suggestion'
  } finally {
    loadingSuggestion.value = false
  }
}

watch(() => props.regionId, () => { loadSuggestion() }, { immediate: true })

async function recheckCollision() {
  collision.value = null
  if (roomIdInput.value === null || Number.isNaN(roomIdInput.value)) return
  if (!suggestion.value) return
  if (!suggestion.value.used_room_ids.includes(roomIdInput.value)) return
  try {
    const r = await $fetch<{ rows: Array<{ room_id: number; name: string | null }> }>(
      `/api/tables/world_rooms`,
      {
        query: {
          q: JSON.stringify({ region_id: props.regionId, room_id: roomIdInput.value }),
          limit: 1,
        },
      },
    )
    if (r.rows.length > 0) {
      collision.value = {
        id: encodeCompositeKey('world_rooms', { region_id: props.regionId, room_id: r.rows[0]!.room_id }),
        name: r.rows[0]!.name,
      }
    }
  } catch {
    // best-effort
  }
}

watch(roomIdInput, () => { recheckCollision() })

function close() {
  open.value = false
  emit('close')
}

async function submit() {
  if (!name.value.trim()) {
    error.value = 'Name is required'
    return
  }
  if (roomIdInput.value === null || Number.isNaN(roomIdInput.value)) {
    error.value = 'room_id is required and must be an integer'
    return
  }
  if (collision.value) {
    error.value = `Room ${roomIdInput.value} already exists: "${collision.value.name ?? ''}". Pick a different id.`
    return
  }
  try {
    JSON.parse(layoutJson.value)
  } catch {
    error.value = 'layout_json is not valid JSON'
    return
  }
  creating.value = true
  error.value = null
  try {
    await $fetch('/api/tables/world_rooms', {
      method: 'POST',
      body: {
        region_id: props.regionId,
        room_id: roomIdInput.value,
        name: name.value.trim(),
        description: description.value || null,
        terrain: terrain.value || null,
        width: width.value,
        height: height.value,
        layout_json: layoutJson.value,
      },
    })
    emit('created', { region_id: props.regionId, room_id: roomIdInput.value, name: name.value.trim() })
    open.value = false
  } catch (e: unknown) {
    const err = e as {
      statusCode?: number
      statusMessage?: string
      data?: {
        statusMessage?: string
        data?: { hint?: string; existing?: { name?: string | null } | null }
      }
    }
    if (err?.statusCode === 409) {
      error.value = err.data?.data?.hint ?? 'That room_id is already taken.'
    } else {
      error.value = err.data?.statusMessage ?? err.statusMessage ?? 'Create failed'
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

function adoptSuggestion() {
  if (suggestion.value) {
    roomIdInput.value = suggestion.value.suggested_room_id
    recheckCollision()
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/60 flex items-start justify-center p-6 overflow-auto" @click.self="close">
    <div class="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-2xl shadow-xl">
      <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h3 class="text-base font-semibold">
          Add room to <span class="font-mono text-sky-300">{{ regionId }}</span>
          <span v-if="regionName" class="text-neutral-400 font-normal">— {{ regionName }}</span>
        </h3>
        <button class="text-neutral-400 hover:text-white" aria-label="Close" @click="close">×</button>
      </div>

      <div class="p-4 space-y-3">
        <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>

        <div class="grid grid-cols-3 gap-3">
          <label class="block text-sm col-span-2">
            <span class="block text-neutral-400 mb-1">name</span>
            <input v-model="name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
          </label>

          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">room_id</span>
            <input
              v-model.number="roomIdInput"
              type="number"
              min="1"
              class="w-full bg-neutral-950 border rounded px-2 py-1 font-mono"
              :class="collision ? 'border-red-600' : 'border-neutral-700'"
            />
          </label>
        </div>

        <div v-if="collision" class="bg-amber-900/30 border border-amber-700 rounded px-3 py-2 text-amber-200 text-xs">
          Room #{{ roomIdInput }} already exists:
          <span class="font-mono">{{ collision.name || '(no name)' }}</span>.
          <NuxtLink :to="`/world_rooms/${encodeURIComponent(collision.id)}`" class="underline">Open existing</NuxtLink>
          or pick another id.
        </div>

        <div class="bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-neutral-400">Suggestion</span>
            <button class="text-sky-400 hover:underline" :disabled="!suggestion" @click="adoptSuggestion">
              use suggestion
            </button>
          </div>
          <div v-if="loadingSuggestion" class="text-neutral-500">computing…</div>
          <div v-else-if="suggestion" class="space-y-0.5">
            <div>
              next free:
              <span class="font-mono text-emerald-300">#{{ suggestion.suggested_room_id }}</span>
              <span class="text-neutral-500">(reason: {{ suggestion.reason }})</span>
            </div>
            <details v-if="suggestion.used_room_ids.length" class="text-neutral-500">
              <summary class="cursor-pointer">used ids ({{ suggestion.used_room_ids.length }})</summary>
              <div class="font-mono break-all">{{ suggestion.used_room_ids.join(', ') }}</div>
            </details>
          </div>
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
            <span class="text-neutral-400 text-sm">layout_json (array of <code>{{ width }}</code> char rows, {{ height }} rows)</span>
            <button class="text-xs text-sky-400 hover:underline" @click="fillSampleLayout">fill blank</button>
          </div>
          <textarea
            v-model="layoutJson"
            rows="6"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
            spellcheck="false"
          />
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-800">
        <button class="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-sm" @click="close">Cancel</button>
        <button
          class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50"
          :disabled="creating || loadingSuggestion || !!collision"
          @click="submit"
        >
          {{ creating ? 'Creating…' : 'Create room' }}
        </button>
      </div>
    </div>
  </div>
</template>