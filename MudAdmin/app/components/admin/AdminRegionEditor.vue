<script setup lang="ts">
import { tilePreviewStyle } from '~/utils/ansi'

const props = defineProps<{
  entityId: string
}>()

const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const showAddRoom = ref(false)
const showAddZone = ref(false)

const { data, refresh } = await useFetch<{
  record: { entity_type: string; entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }
}>(() => `/api/entities/region/${encodeURIComponent(props.entityId)}`)

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
    .filter((z) => String(z.doc.region_id ?? z.entity_id.split('::')[0]) === props.entityId)
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

const paletteTiles = ref<Record<string, unknown>[]>([])

watchEffect(() => {
  const d = currentDoc.value
  draft.name = String(d.name ?? '')
  draft.description = String(d.description ?? '')
  draft.floor_tribe = String(d.floor_tribe ?? '')
  draft.floor_index = d.floor_index === undefined || d.floor_index === null ? null : Number(d.floor_index)
  draft.floor_meta = d.floor_meta === undefined || d.floor_meta === null ? null : Number(d.floor_meta)
  draft.biome_theme = String(d.biome_theme ?? '')
  paletteTiles.value = Array.isArray(d.floor_palette) ? (d.floor_palette as Record<string, unknown>[]).map((t) => ({ ...t })) : []
})

const PALETTE_COLUMNS = [
  { key: 'symbol', widget: 'text' as const, placeholder: '~' },
  { key: 'name', widget: 'text' as const },
  { key: 'color', widget: 'color' as const },
  { key: 'bg_color', widget: 'bgcolor' as const },
  { key: 'blocks_move', widget: 'select' as const, options: [{ value: '0', label: 'walkable' }, { value: '1', label: 'blocks move' }] },
  { key: 'blocks_sight', widget: 'select' as const, options: [{ value: '0', label: 'clear' }, { value: '1', label: 'blocks sight' }] },
  { key: 'move_cost', widget: 'number' as const, min: 1 },
]

function normalizePalette(tiles: Record<string, unknown>[]) {
  return tiles.map((tile) => ({
    symbol: String(tile.symbol ?? ''),
    name: String(tile.name ?? ''),
    color: String(tile.color ?? ''),
    bg_color: String(tile.bg_color ?? ''),
    blocks_move: tile.blocks_move === true || tile.blocks_move === 1 || tile.blocks_move === '1' ? 1 : 0,
    blocks_sight: tile.blocks_sight === true || tile.blocks_sight === 1 || tile.blocks_sight === '1' ? 1 : 0,
    move_cost: Number(tile.move_cost ?? 1) || 1,
  }))
}

const palettePreview = computed(() => normalizePalette(paletteTiles.value))

const saving = ref(false)

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
  try {
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
    if (!paletteTiles.value.length) delete next.floor_palette
    else next.floor_palette = normalizePalette(paletteTiles.value)

    await $fetch(`/api/entities/region/${encodeURIComponent(props.entityId)}`, {
      method: 'PUT',
      body: { doc: next },
    })
    toast.success(`Saved ${props.entityId}`)
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.error(err.data?.statusMessage ?? err.message ?? 'Save failed')
  } finally {
    saving.value = false
  }
}

function openMap() {
  navigateTo(`/world/regions/${encodeURIComponent(props.entityId)}/map`)
}
</script>

<template>
  <div v-if="!data?.record" class="text-neutral-400">Region not found.</div>
  <div v-else class="space-y-4 max-w-4xl">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <NuxtLink to="/world/regions" class="text-sky-400 hover:underline text-sm">← regions</NuxtLink>
        <h2 class="text-xl font-semibold font-mono">{{ entityId }}</h2>
      </div>
      <div class="flex gap-2">
        <UiButton size="sm" @click="showAddRoom = true">+ Add room</UiButton>
        <UiButton size="sm" @click="openMap">Open map</UiButton>
        <UiButton size="sm" @click="openRaw">Raw JSON</UiButton>
        <UiButton size="sm" variant="primary" :loading="saving" @click="save">{{ saving ? 'Saving…' : 'Save' }}</UiButton>
      </div>
    </div>

    <AdminAddRoomModal
      v-if="showAddRoom"
      :region-id="entityId"
      :region-name="draft.name"
      @close="showAddRoom = false"
      @created="async () => { showAddRoom = false }"
    />

    <div v-if="showRaw" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Raw document</h3>
        <div class="flex gap-2">
          <UiButton size="sm" variant="primary" @click="applyRaw">Apply</UiButton>
          <UiButton size="sm" @click="showRaw = false">Cancel</UiButton>
        </div>
      </div>
      <textarea v-model="rawText" rows="18" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"></textarea>
      <p v-if="rawError" class="text-xs text-red-300">{{ rawError }}</p>
    </div>

    <UiPanel title="Identity">
      <div class="space-y-3">
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">name</span>
          <input v-model="draft.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">description</span>
          <textarea v-model="draft.description" rows="3" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" />
        </label>
      </div>
    </UiPanel>

    <UiPanel title="Floor metadata">
      <p class="text-xs text-neutral-500 mb-3">
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
    </UiPanel>

    <UiPanel title="Floor palette (per-region)">
      <p class="text-xs text-neutral-500 mb-3">
        Terrain tiles for rooms in <code>{{ entityId }}</code>; symbols not listed fall back to the global
        <NuxtLink to="/entities/terrain" class="text-sky-400 hover:underline">palette</NuxtLink>.
        Blocks flags are normalized to 0/1 on save.
      </p>
      <AdminEntityArrayField
        :model-value="paletteTiles"
        :columns="PALETTE_COLUMNS"
        add-label="+ Add tile"
        @update:model-value="(v) => paletteTiles = v as Record<string, unknown>[]"
      />
      <div v-if="palettePreview.length" class="mt-3 space-y-1">
        <div class="text-xs text-neutral-500">Preview ({{ palettePreview.length }} tile(s)):</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(t, i) in palettePreview"
            :key="i + t.symbol + t.name"
            class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono flex items-center gap-2"
          >
            <span
              class="inline-block w-6 text-center text-base font-bold rounded"
              :style="tilePreviewStyle(t.color, t.bg_color)"
            >{{ t.symbol }}</span>
            <span class="text-neutral-300">{{ t.name }}</span>
            <span class="text-neutral-600">{{ t.color }}{{ t.bg_color ? ' ' + t.bg_color : '' }}</span>
          </div>
        </div>
      </div>
    </UiPanel>

    <UiPanel title="Zones">
      <template #actions>
        <UiButton size="sm" @click="showAddZone = true">+ New zone</UiButton>
      </template>
      <p class="text-xs text-neutral-500 mb-2">
        A zone is a numbered partition of rooms in this region. Each zone can carry rule flags
        (PvP, magic, recall, respawn) and optionally reference a Lua generator for procedural rooms.
      </p>

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
    </UiPanel>

    <AdminAddZoneModal
      v-if="showAddZone"
      :region-id="entityId"
      :region-name="draft.name"
      :existing-zone-ids="existingZoneIds"
      @close="showAddZone = false"
      @created="async () => { showAddZone = false; await refreshZones() }"
    />
  </div>
</template>
