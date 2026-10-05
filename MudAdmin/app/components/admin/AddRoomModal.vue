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
const layoutJson = ref<string>('[]')
const creating = ref(false)
const error = ref<string | null>(null)
const assignedRoomId = ref<number | null>(null)
const assignedRoomKey = computed(() =>
  assignedRoomId.value !== null
    ? encodeURIComponent(encodeCompositeKey('world_rooms', { region_id: props.regionId, room_id: assignedRoomId.value }))
    : null,
)

function close() {
  open.value = false
  emit('close')
}

async function submit() {
  if (!name.value.trim()) {
    error.value = 'Name is required'
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
  assignedRoomId.value = null
  try {
    const res = await $fetch<{ id: number | null }>('/api/tables/world_rooms', {
      method: 'POST',
      body: {
        region_id: props.regionId,
        name: name.value.trim(),
        description: description.value || null,
        terrain: terrain.value || null,
        width: width.value,
        height: height.value,
        layout_json: layoutJson.value,
      },
    })
    const newId = res.id
    if (typeof newId !== 'number') {
      throw new Error('Server did not assign a room_id')
    }
    assignedRoomId.value = newId
    emit('created', { region_id: props.regionId, room_id: newId, name: name.value.trim() })
  } catch (e: unknown) {
    const err = e as {
      statusCode?: number
      statusMessage?: string
      data?: { statusMessage?: string; data?: { hint?: string } }
    }
    if (err?.statusCode === 409) {
      error.value = err.data?.data?.hint ?? 'That room already exists.'
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
          Add room to <span class="font-mono text-sky-300">{{ regionId }}</span>
          <span v-if="regionName" class="text-neutral-400 font-normal">— {{ regionName }}</span>
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
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">name</span>
            <input v-model="name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
          </label>

          <div class="bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-400">
            room_id will be assigned automatically (next free in
            <span class="font-mono text-neutral-300">{{ regionId }}</span>).
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
          :disabled="creating || !name.trim()"
          @click="submit"
        >
          {{ creating ? 'Creating…' : 'Create room' }}
        </button>
      </div>
    </div>
  </div>
</template>