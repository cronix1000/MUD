<script setup lang="ts">
import { ENTITY_SCHEMAS } from '~/utils/entitySchemas'

const props = defineProps<{
  entityType: string
}>()

const emit = defineEmits<{ created: [id: string]; close: [] }>()

const toast = useToast()

const schema = computed(() => ENTITY_SCHEMAS[props.entityType]!)

const id = ref('')
const name = ref('')
const description = ref('')
const parentId = ref('')
const creating = ref(false)
const error = ref<string | null>(null)

const isRoom = computed(() => props.entityType === 'room')
const isZone = computed(() => props.entityType === 'zone')
const isDialogue = computed(() => props.entityType === 'dialogue')
const isMob = computed(() => props.entityType === 'mob')

const dialogueMode = ref<'node' | 'voice'>('node')
const dialogueText = ref('')
const roomRegion = ref('')
const roomTerrain = ref('')
const roomWidth = ref(10)
const roomHeight = ref(8)
const suggestedRoomId = ref<number | null>(null)
const mobChar = ref('M')
const mobHp = ref(100)
const mobLevel = ref(1)
const mobAi = ref('none')

interface ListResponse { rows: Array<{ entity_id: string; doc: Record<string, unknown>; parent_id: string | null }> }

const { data: sameType } = useFetch<ListResponse>(() => `/api/entities/${props.entityType}`, {
  query: { limit: 500 },
  watch: [() => props.entityType],
})

const needsRegions = computed(() => isRoom.value || isZone.value)
const { data: regionsData } = useFetch<ListResponse>('/api/entities/region', {
  query: { limit: 500 },
  immediate: false,
  watch: [needsRegions],
})

const needsTerrains = computed(() => isRoom.value)
const { data: terrainsData } = useFetch<ListResponse>('/api/entities/terrain', {
  query: { limit: 500 },
  immediate: false,
  watch: [needsTerrains],
})

const suggestedZoneId = computed(() => {
  if (!isZone.value || !roomRegion.value) return null
  const used = (sameType.value?.rows ?? [])
    .filter((z) => String(z.doc.region_id ?? '') === roomRegion.value)
    .map((z) => Number(z.doc.zone_id ?? 0))
  return used.length ? Math.max(...used) + 1 : 1
})

const terrainSymbols = computed(() =>
  (terrainsData.value?.rows ?? []).map((r) => String(r.doc.symbol ?? r.entity_id)).filter(Boolean),
)

watch(roomRegion, async (region) => {
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

function blankLayout(w: number, h: number): string[] {
  const cols = Math.min(Math.max(Math.trunc(w) || 10, 1), 200)
  const rows = Math.min(Math.max(Math.trunc(h) || 8, 1), 200)
  return Array.from({ length: rows }, () => '.'.repeat(cols))
}

function buildId(): string | null {
  if (isRoom.value) {
    if (!roomRegion.value || !suggestedRoomId.value) return null
    return `${roomRegion.value}::${suggestedRoomId.value}`
  }
  if (isZone.value) {
    if (!roomRegion.value || !suggestedZoneId.value) return null
    return `${roomRegion.value}::${suggestedZoneId.value}`
  }
  return id.value.trim() || null
}

function buildDoc(): Record<string, unknown> | null {
  const nm = name.value.trim()
  if (isRoom.value) {
    if (!nm) return null
    return {
      region_id: roomRegion.value,
      room_id: suggestedRoomId.value,
      name: nm,
      description: description.value.trim(),
      terrain: roomTerrain.value.trim() || null,
      width: Math.min(Math.max(Math.trunc(roomWidth.value) || 10, 1), 200),
      height: Math.min(Math.max(Math.trunc(roomHeight.value) || 8, 1), 200),
      layout: blankLayout(roomWidth.value, roomHeight.value),
      spawn_x: 0,
      spawn_y: 0,
      zone_id: 0,
      scripts: {},
      exits: {},
      spawns: [],
    }
  }
  if (isZone.value) {
    if (!nm) return null
    return {
      region_id: roomRegion.value,
      zone_id: suggestedZoneId.value,
      name: nm,
      description: '',
      is_active: true,
      rules: {},
    }
  }
  if (isDialogue.value) {
    if (dialogueMode.value === 'node') return { text: dialogueText.value.trim(), options: [] }
    return { idle: [], combat: [], death: [] }
  }
  if (isMob.value) {
    if (!nm) return null
    if (parentId.value) return { name: nm }
    return {
      name: nm,
      char: mobChar.value || 'M',
      hp: Number(mobHp.value) || 100,
      level: Number(mobLevel.value) || 1,
      ai: mobAi.value || 'none',
      attack_damage: 0,
      attack_speed: 0,
      critical_chance: 0,
      critical_multiplier: 1.5,
      stat: { strength: 0, dexterity: 0, intelligence: 0 },
    }
  }
  return nm ? { name: nm } : null
}

const ready = computed(() => !!buildId() && !!buildDoc())

async function create() {
  const newId = buildId()
  const doc = buildDoc()
  if (!newId || !doc) {
    error.value = isRoom.value || isZone.value ? 'region and name are required' : 'id and name are required'
    return
  }
  creating.value = true
  error.value = null
  try {
    await $fetch(`/api/entities/${props.entityType}`, {
      method: 'POST',
      body: { id: newId, doc, parent_id: (!isRoom.value && !isZone.value && parentId.value.trim()) || null },
    })
    toast.success(`Created ${newId}`)
    emit('created', newId)
    await navigateTo(`/entities/${props.entityType}/${encodeURIComponent(newId)}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Create failed'
  } finally {
    creating.value = false
  }
}

const showParent = computed(() => !isRoom.value && !isZone.value && !isDialogue.value)
</script>

<template>
  <div class="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 overflow-auto" @click.self="$emit('close')">
    <div class="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-2xl mt-12 p-4 space-y-4" role="dialog" aria-modal="true">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold">New {{ schema.singular.toLowerCase() }}</h3>
        <button class="text-sm text-neutral-400 hover:text-neutral-200" @click="$emit('close')">close</button>
      </div>

      <div v-if="isDialogue" class="flex gap-2">
        <button
          class="px-3 py-1 rounded border text-sm"
          :class="dialogueMode === 'node' ? 'border-emerald-600 bg-emerald-900/40 text-emerald-200' : 'border-neutral-700 hover:bg-neutral-800'"
          @click="dialogueMode = 'node'"
        >Dialogue node</button>
        <button
          class="px-3 py-1 rounded border text-sm"
          :class="dialogueMode === 'voice' ? 'border-emerald-600 bg-emerald-900/40 text-emerald-200' : 'border-neutral-700 hover:bg-neutral-800'"
          @click="dialogueMode = 'voice'"
        >Voice set</button>
      </div>
      <p v-if="isDialogue" class="text-xs text-neutral-500">
        <template v-if="dialogueMode === 'node'">A node is one NPC speech with player options linking to other nodes (or EXIT).</template>
        <template v-else>A voice set is a bag of random idle/combat/death barks for mobs.</template>
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label v-if="isRoom || isZone" class="block text-sm">
          <span class="block text-neutral-400 mb-1">region</span>
          <select v-model="roomRegion" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
            <option value="">— pick a region —</option>
            <option v-for="r in regionsData?.rows ?? []" :key="r.entity_id" :value="r.entity_id">{{ r.entity_id }}{{ typeof r.doc.name === 'string' && r.doc.name ? ' — ' + r.doc.name : '' }}</option>
          </select>
        </label>

        <label v-if="isRoom" class="block text-sm">
          <span class="block text-neutral-400 mb-1">room_id (auto)</span>
          <input :value="roomRegion ? suggestedRoomId ?? '…' : ''" disabled class="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 font-mono text-sm opacity-60" />
        </label>

        <label v-if="isZone" class="block text-sm">
          <span class="block text-neutral-400 mb-1">zone_id (auto)</span>
          <input :value="roomRegion ? suggestedZoneId ?? '…' : ''" disabled class="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 font-mono text-sm opacity-60" />
        </label>

        <label v-if="!isRoom && !isZone" class="block text-sm">
          <span class="block text-neutral-400 mb-1">{{ schema.idLabel }}</span>
          <input v-model="id" :placeholder="schema.idPlaceholder ?? ''" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" @keydown.enter="create" />
        </label>

        <label v-if="!isDialogue" class="block text-sm">
          <span class="block text-neutral-400 mb-1">name</span>
          <input v-model="name" placeholder="Entry Hall" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
        </label>

        <label v-if="isDialogue && dialogueMode === 'node'" class="block text-sm">
          <span class="block text-neutral-400 mb-1">opening text</span>
          <input v-model="dialogueText" placeholder="Welcome to my forge, traveler." class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
        </label>

        <label v-if="isRoom" class="block text-sm">
          <span class="block text-neutral-400 mb-1">terrain</span>
          <input v-model="roomTerrain" list="create-panel-terrains" placeholder="grass" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
          <datalist id="create-panel-terrains">
            <option v-for="t in terrainSymbols" :key="t" :value="t" />
          </datalist>
        </label>

        <div v-if="isRoom" class="grid grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">width</span>
            <input v-model.number="roomWidth" type="number" min="1" max="200" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">height</span>
            <input v-model.number="roomHeight" type="number" min="1" max="200" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
          </label>
        </div>

        <label v-if="isRoom" class="block text-sm md:col-span-2">
          <span class="block text-neutral-400 mb-1">description</span>
          <input v-model="description" placeholder="A dusty entrance." class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
        </label>

        <template v-if="isMob && !parentId">
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">char</span>
            <input v-model="mobChar" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">hp</span>
            <input v-model.number="mobHp" type="number" min="1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">level</span>
            <input v-model.number="mobLevel" type="number" min="1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
          </label>
          <label class="block text-sm">
            <span class="block text-neutral-400 mb-1">ai</span>
            <input v-model="mobAi" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
          </label>
        </template>

        <label v-if="showParent" class="block text-sm md:col-span-2">
          <span class="block text-neutral-400 mb-1">parent (optional — inherit from another {{ schema.singular.toLowerCase() }})</span>
          <select v-model="parentId" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
            <option value="">— none —</option>
            <option v-for="r in sameType?.rows ?? []" :key="r.entity_id" :value="r.entity_id">{{ r.entity_id }}{{ typeof r.doc.name === 'string' && r.doc.name ? ' — ' + r.doc.name : '' }}</option>
          </select>
        </label>
      </div>

      <p v-if="isRoom" class="text-xs text-neutral-500">room_id is the next free id for the region. Layout starts as a blank grid — paint it in the editor.</p>

      <p v-if="error" class="text-xs text-red-300">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <UiButton size="sm" @click="$emit('close')">Cancel</UiButton>
        <UiButton size="sm" variant="primary" :loading="creating" :disabled="!ready" @click="create">
          {{ creating ? 'Creating…' : `Create ${schema.singular.toLowerCase()}` }}
        </UiButton>
      </div>
    </div>
  </div>
</template>
