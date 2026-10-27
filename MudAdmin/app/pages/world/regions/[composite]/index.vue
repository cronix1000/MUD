<script setup lang="ts">
import { ansiToCss } from '~/utils/ansi'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const regionId = computed(() => decodeURIComponent(String(route.params.composite)))
const showAddRoom = ref(false)
const showAddZone = ref(false)

const { data, refresh } = await useFetch<{
  record: { entity_type: string; entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }
}>(() => `/api/entities/region/${encodeURIComponent(regionId.value)}`)

const currentDoc = ref<Record<string, unknown>>({})

watchEffect(() => {
  if (!data.value?.record) return
  currentDoc.value = data.value.record.doc
})

interface ZoneCard {
  entity_id: string
  region_id: string
  zone_id: number
  name: string
  description: string
  zone_script_ref: string
  is_active: boolean
}

const { data: zonesData, refresh: refreshZones } = await useFetch<{
  rows: Array<{ entity_id: string; doc: Record<string, unknown> }>
}>('/api/entities/zone', { query: { limit: 500 } })

const zonesInRegion = computed<ZoneCard[]>(() =>
  (zonesData.value?.rows ?? [])
    .filter((z) => String(z.doc.region_id ?? z.entity_id.split('::')[0]) === regionId.value)
    .map((z) => ({
      entity_id: z.entity_id,
      region_id: String(z.doc.region_id ?? ''),
      zone_id: Number(z.doc.zone_id ?? 0),
      name: String(z.doc.name ?? ''),
      description: String(z.doc.description ?? ''),
      zone_script_ref: String(z.doc.zone_script_ref ?? ''),
      is_active: z.doc.is_active === true,
    }))
    .sort((a, b) => a.zone_id - b.zone_id),
)

const existingZoneIds = computed<number[]>(() => zonesInRegion.value.map((z) => z.zone_id))

const TRIBES = ['orcs', 'humans', 'angels', 'monumentals', 'faery', 'devils', 'jinn'] as const
const BIOMES = ['sahara', 'wetland', 'mountain', 'plain', 'swamp', 'desert', 'tundra_volcano'] as const

const draft = reactive({
  name: '',
  description: '',
  floor_tribe: '' as string,
  floor_index: null as number | null,
  floor_meta: null as number | null,
  biome_theme: '' as string,
})

const paletteText = ref('[]')

watchEffect(() => {
  const d = currentDoc.value
  draft.name = String(d.name ?? '')
  draft.description = String(d.description ?? '')
  draft.floor_tribe = String(d.floor_tribe ?? '')
  draft.floor_index = d.floor_index === undefined || d.floor_index === null ? null : Number(d.floor_index)
  draft.floor_meta = d.floor_meta === undefined || d.floor_meta === null ? null : Number(d.floor_meta)
  draft.biome_theme = String(d.biome_theme ?? '')
  paletteText.value = d.floor_palette === undefined ? '' : JSON.stringify(d.floor_palette, null, 2)
})

interface PaletteTile {
  symbol: string
  name: string
  color: string
  blocks_move: number
  blocks_sight: number
  move_cost: number
}

const paletteRows = computed<PaletteTile[]>(() => {
  try {
    const parsed = JSON.parse(paletteText.value || '[]')
    return Array.isArray(parsed) ? (parsed as PaletteTile[]) : []
  } catch {
    return []
  }
})

function normalizePalette(tiles: unknown): PaletteTile[] {
  if (!Array.isArray(tiles)) throw new Error('floor_palette must be an array')
  return tiles.map((t) => {
    const tile = (t ?? {}) as Record<string, unknown>
    return {
      symbol: String(tile.symbol ?? ''),
      name: String(tile.name ?? ''),
      color: String(tile.color ?? ''),
      blocks_move: tile.blocks_move === true || tile.blocks_move === 1 ? 1 : 0,
      blocks_sight: tile.blocks_sight === true || tile.blocks_sight === 1 ? 1 : 0,
      move_cost: Number(tile.move_cost ?? 1) || 1,
    }
  })
}

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const showRaw = ref(false)
const rawText = ref('')
const rawError = ref<string | null>(null)

function openRaw() {
  rawText.value = JSON.stringify(currentDoc.value, null, 2)
  rawError.value = null
  showRaw.value = true
}
function applyRaw() {
  try {
    const parsed = JSON.parse(rawText.value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('doc must be a JSON object')
    }
    currentDoc.value = parsed
    rawError.value = null
    showRaw.value = false
  } catch (e) {
    rawError.value = e instanceof Error ? e.message : 'Invalid JSON'
  }
}

async function save() {
  saving.value = true
  error.value = null
  success.value = null
  try {
    let palette: PaletteTile[] | null = null
    if (paletteText.value.trim()) {
      palette = normalizePalette(JSON.parse(paletteText.value))
    }
    const next: Record<string, unknown> = {
      ...currentDoc.value,
      name: draft.name.trim(),
      description: draft.description,
    }
    if (draft.floor_tribe) next.floor_tribe = draft.floor_tribe
    else delete next.floor_tribe
    if (draft.biome_theme) next.biome_theme = draft.biome_theme
    else delete next.biome_theme
    if (draft.floor_index !== null) next.floor_index = Number(draft.floor_index)
    else delete next.floor_index
    if (draft.floor_meta !== null) next.floor_meta = Number(draft.floor_meta)
    else delete next.floor_meta
    if (palette === null) delete next.floor_palette
    else next.floor_palette = palette

    await $fetch(`/api/entities/region/${encodeURIComponent(regionId.value)}`, {
      method: 'PUT',
      body: { doc: next },
    })
    success.value = 'Saved.'
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    error.value = err.data?.statusMessage ?? err.message ?? 'Save failed'
  } finally {
    saving.value = false
  }
}

const seeding = ref(false)
const seedMessage = ref<string | null>(null)
async function seedFloors() {
  seeding.value = true
  seedMessage.value = null
  try {
    const res = await $fetch<{ ok: boolean; message: string }>('/api/terrains/seed-floors', { method: 'POST' })
    seedMessage.value = res.message
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    seedMessage.value = err.data?.statusMessage ?? 'Seed failed'
  } finally {
    seeding.value = false
  }
}

function openMap() {
  navigateTo(`/world/regions/${encodeURIComponent(regionId.value)}/map`)
}
</script>

<template>
  <div v-if="!data?.record" class="text-neutral-400">Region not found.</div>
  <div v-else class="space-y-4 max-w-3xl">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <NuxtLink to="/world/regions" class="text-sky-400 hover:underline text-sm">← regions</NuxtLink>
        <h2 class="text-xl font-semibold font-mono">{{ regionId }}</h2>
      </div>
      <div class="flex gap-2">
        <button class="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-sm" @click="showAddRoom = true">+ Add room</button>
        <button class="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-sm" @click="openMap">Open map</button>
        <button class="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sm" @click="openRaw">Raw JSON</button>
        <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <AdminAddRoomModal
      v-if="showAddRoom"
      :region-id="regionId"
      :region-name="draft.name"
      @close="showAddRoom = false"
      @created="async () => { showAddRoom = false }"
    />

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div v-if="showRaw" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Raw document</h3>
        <div class="flex gap-2">
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="applyRaw">Apply</button>
          <button class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded" @click="showRaw = false">Cancel</button>
        </div>
      </div>
      <textarea v-model="rawText" rows="18" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"></textarea>
      <p v-if="rawError" class="text-xs text-red-300">{{ rawError }}</p>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <h3 class="text-sm font-semibold">Identity</h3>
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="draft.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
      </label>
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">description</span>
        <textarea v-model="draft.description" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
      </label>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <h3 class="text-sm font-semibold">Floor metadata</h3>
      <p class="text-xs text-neutral-500">
        Tag this region as one of the 7 tribal floors (or leave blank for hand-authored zones).
        Used by the C++ server to pick the per-region palette and by region navigation.
      </p>
      <div class="grid grid-cols-2 gap-3">
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">tribe</span>
          <select v-model="draft.floor_tribe" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1">
            <option value="">— none —</option>
            <option v-for="t in TRIBES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">biome_theme</span>
          <select v-model="draft.biome_theme" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1">
            <option value="">— none —</option>
            <option v-for="b in BIOMES" :key="b" :value="b">{{ b }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">floor_index (1–7)</span>
          <input v-model.number="draft.floor_index" type="number" min="1" max="7" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">floor_meta (0–9, which of 10 sister zones)</span>
          <input v-model.number="draft.floor_meta" type="number" min="0" max="9" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold">Floor palette (per-region)</h3>
          <p class="text-xs text-neutral-500 mt-1">
            JSON array of terrain tiles. The C++ server uses this palette for rooms in
            <code>{{ regionId }}</code>; symbols not listed fall back to the global
            <NuxtLink to="/world/terrains" class="text-sky-400 hover:underline">palette</NuxtLink>.
          </p>
        </div>
        <button
          class="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-xs disabled:opacity-50"
          :disabled="seeding"
          @click="seedFloors"
        >
          {{ seeding ? 'Seeding…' : 'Seed starter palette' }}
        </button>
      </div>
      <div v-if="seedMessage" class="bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-xs text-neutral-300">
        {{ seedMessage }}
      </div>
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">floor_palette (blocks flags are normalized to 0/1 on save)</span>
        <textarea
          v-model="paletteText"
          rows="14"
          class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
          spellcheck="false"
        />
      </label>
      <div v-if="paletteRows.length" class="space-y-1">
        <div class="text-xs text-neutral-500">Preview ({{ paletteRows.length }} tile(s)):</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(t, i) in paletteRows"
            :key="i + t.symbol + t.name"
            class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono flex items-center gap-2"
          >
            <span
              class="inline-block w-6 text-center text-base font-bold"
              :style="{ color: ansiToCss(t.color) }"
            >{{ t.symbol }}</span>
            <span class="text-neutral-300">{{ t.name }}</span>
            <span class="text-neutral-600">{{ t.color }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold">Zones</h3>
          <p class="text-xs text-neutral-500 mt-1">
            A zone is a numbered partition of rooms in this region. Each zone can carry rule flags
            (PvP, magic, recall, respawn) and optionally reference a Lua generator for procedural rooms.
          </p>
        </div>
        <button
          class="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-xs"
          @click="showAddZone = true"
        >
          + New zone
        </button>
      </div>

      <div v-if="!zonesInRegion.length" class="text-xs text-neutral-500">
        No zones yet. Existing rooms fall back to <code>zone_id=0</code> (legacy "no zone").
      </div>
      <ul v-else class="divide-y divide-neutral-800">
        <li
          v-for="z in zonesInRegion"
          :key="z.entity_id"
          class="py-2 flex items-center gap-3"
        >
          <span class="font-mono text-indigo-300 w-12">#{{ z.zone_id }}</span>
          <span class="flex-1">
            <NuxtLink
              :to="`/entities/zone/${encodeURIComponent(z.entity_id)}`"
              class="text-neutral-100 hover:underline font-medium"
            >{{ z.name }}</NuxtLink>
            <span v-if="z.zone_script_ref" class="ml-2 text-xs text-amber-400 font-mono">[procedural: {{ z.zone_script_ref }}]</span>
            <span v-if="z.description" class="block text-xs text-neutral-500 mt-0.5">{{ z.description }}</span>
          </span>
          <span class="text-xs text-neutral-500 font-mono">{{ z.is_active ? 'active' : 'inactive' }}</span>
        </li>
      </ul>
    </div>

    <AdminAddZoneModal
      v-if="showAddZone"
      :region-id="regionId"
      :region-name="draft.name"
      :existing-zone-ids="existingZoneIds"
      @close="showAddZone = false"
      @created="async () => { showAddZone = false; await refreshZones() }"
    />
  </div>
</template>
