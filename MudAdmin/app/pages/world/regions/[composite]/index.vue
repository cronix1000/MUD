<script setup lang="ts">
import { encodeCompositeKey } from '~/utils/composite-key'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const compositeKey = computed(() => decodeURIComponent(String(route.params.composite)))
const regionId = computed(() => compositeKey.value)

interface RegionRow {
  id: string
  name: string
  description: string | null
  region_kind: string
  generator_script: string | null
  template_config_json: string | null
  tutorial_steps_json: string | null
  floor_tribe: string | null
  floor_index: number | null
  floor_meta: number | null
  biome_theme: string | null
  floor_palette_json: string | null
}

const { data, refresh } = await useFetch<{ rows: RegionRow[] }>('/api/tables/world_regions')
const region = computed(() => (data.value?.rows ?? []).find((r) => r.id === regionId.value))

const TRIBES = ['orcs', 'humans', 'angels', 'monumentals', 'faery', 'devils', 'jinn'] as const
const BIOMES = [
  'sahara',
  'wetland',
  'mountain',
  'plain',
  'swamp',
  'desert',
  'tundra_volcano',
] as const

const draft = reactive({
  name: '',
  description: '',
  region_kind: 'static' as 'static' | 'tutorial' | 'instanced',
  generator_script: '' as string,
  template_config_json: '{}' as string,
  tutorial_steps_json: '[]' as string,
  floor_tribe: '' as string,
  floor_index: null as number | null,
  floor_meta: null as number | null,
  biome_theme: '' as string,
  floor_palette_json: '[]' as string,
})

watchEffect(() => {
  if (!region.value) return
  draft.name = region.value.name
  draft.description = region.value.description ?? ''
  draft.region_kind = (region.value.region_kind ?? 'static') as typeof draft.region_kind
  draft.generator_script = region.value.generator_script ?? ''
  draft.template_config_json = region.value.template_config_json ?? '{}'
  draft.tutorial_steps_json = region.value.tutorial_steps_json ?? '[]'
  draft.floor_tribe = region.value.floor_tribe ?? ''
  draft.floor_index = region.value.floor_index ?? null
  draft.floor_meta = region.value.floor_meta ?? null
  draft.biome_theme = region.value.biome_theme ?? ''
  draft.floor_palette_json = region.value.floor_palette_json ?? '[]'
})

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

async function save() {
  if (!region.value) return
  saving.value = true
  error.value = null
  try {
    JSON.parse(draft.template_config_json)
  } catch {
    error.value = 'template_config_json is not valid JSON'
    saving.value = false
    return
  }
  try {
    JSON.parse(draft.tutorial_steps_json)
  } catch {
    error.value = 'tutorial_steps_json is not valid JSON'
    saving.value = false
    return
  }
  try {
    JSON.parse(draft.floor_palette_json)
  } catch {
    error.value = 'floor_palette_json is not valid JSON'
    saving.value = false
    return
  }
  try {
    const key = `${regionId.value}`
    await $fetch(`/api/tables/world_regions/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: {
        name: draft.name,
        description: draft.description || null,
        region_kind: draft.region_kind,
        generator_script: draft.region_kind !== 'static' ? draft.generator_script || null : null,
        template_config_json: draft.region_kind !== 'static' ? draft.template_config_json : null,
        tutorial_steps_json: draft.region_kind === 'tutorial' ? draft.tutorial_steps_json : null,
        floor_tribe: draft.floor_tribe || null,
        floor_index: draft.floor_index,
        floor_meta: draft.floor_meta,
        biome_theme: draft.biome_theme || null,
        floor_palette_json: draft.floor_palette_json,
      },
    })
    success.value = 'Saved.'
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Save failed'
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
    const res = await $fetch<{ ok: boolean; message: string }>(
      '/api/terrains/seed-floors',
      { method: 'POST' },
    )
    seedMessage.value = res.message
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    seedMessage.value = err.data?.statusMessage ?? 'Seed failed'
  } finally {
    seeding.value = false
  }
}

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
    const parsed = JSON.parse(draft.floor_palette_json || '[]')
    return Array.isArray(parsed) ? (parsed as PaletteTile[]) : []
  } catch {
    return []
  }
})

const swatchStyle = (color: string) => {
  const code = (color || '').slice(1, 2)
  return {
    color: code === 'r' ? '#f87171'
      : code === 'g' ? '#4ade80'
      : code === 'y' ? '#facc15'
      : code === 'b' ? '#60a5fa'
      : code === 'm' ? '#c084fc'
      : code === 'c' ? '#22d3ee'
      : code === 'w' ? '#ffffff'
      : code === 'G' ? '#9ca3af'
      : code === 'Y' ? '#fde047'
      : code === 'B' ? '#3b82f6'
      : code === 'M' ? '#d946ef'
      : code === 'C' ? '#06b6d4'
      : code === 'W' ? '#f3f4f6'
      : code === 'D' ? '#525252'
      : code === 'R' ? '#dc2626'
      : code === 'X' ? '#0a0a0a'
      : code === 'x' ? '#a3a3a3'
      : '#ffffff',
  }
}

const GENERATORS = [
  'regions/generators/cave.lua',
  'regions/generators/dungeon.lua',
  'regions/generators/wilderness.lua',
]

const previewing = ref(false)
const previewData = ref<{
  region: { name: string; region_kind: string }
  generator_script: string | null
  generator_body: string | null
  template_config_json: unknown
  tutorial_steps_json: unknown
  preview_note: string
} | null>(null)

async function previewInstance() {
  previewing.value = true
  try {
    const key = `${regionId.value}`
    previewData.value = await $fetch(`/api/regions/${encodeURIComponent(key)}/preview-instance`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Preview failed'
  } finally {
    previewing.value = false
  }
}

function openMap() {
  navigateTo(`/world/regions/${encodeURIComponent(compositeKey.value)}/map`)
}
</script>

<template>
  <div v-if="!region" class="text-neutral-400">Region not found.</div>
  <div v-else class="space-y-4 max-w-3xl">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <NuxtLink to="/world/regions" class="text-sky-400 hover:underline text-sm">← regions</NuxtLink>
        <h2 class="text-xl font-semibold font-mono">{{ region.id }}</h2>
      </div>
      <div class="flex gap-2">
        <button class="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-sm" @click="openMap">Open map</button>
        <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

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
      <h3 class="text-sm font-semibold">Region kind</h3>
      <p class="text-xs text-neutral-500">
        Static = hand-authored rooms in <code>world_rooms</code>.
        Instanced = Lua generator script builds rooms in-memory when a player enters.
        Tutorial = static rooms with guided step sequence.
      </p>
      <div class="flex gap-2">
        <button
          v-for="k in ['static','instanced','tutorial'] as const"
          :key="k"
          class="px-3 py-1.5 rounded text-sm border"
          :class="draft.region_kind === k ? 'bg-emerald-700 border-emerald-500' : 'bg-neutral-950 border-neutral-700 hover:border-neutral-500'"
          @click="draft.region_kind = k"
        >
          {{ k }}
        </button>
      </div>

      <div v-if="draft.region_kind === 'instanced'" class="space-y-3 pt-2">
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">generator_script</span>
          <div class="flex gap-2">
            <input
              v-model="draft.generator_script"
              class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
              placeholder="regions/generators/cave.lua"
            />
            <select
              class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
              @change="(e) => { draft.generator_script = (e.target as HTMLSelectElement).value }"
            >
              <option value="">pick…</option>
              <option v-for="g in GENERATORS" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
        </label>
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">template_config_json</span>
          <textarea
            v-model="draft.template_config_json"
            rows="6"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
          />
        </label>
        <button class="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-sm disabled:opacity-50" :disabled="previewing" @click="previewInstance">
          {{ previewing ? 'Loading…' : 'Preview generator' }}
        </button>
      </div>

      <div v-if="draft.region_kind === 'tutorial'" class="space-y-3 pt-2">
        <label class="block text-sm">
          <span class="block text-neutral-400 mb-1">tutorial_steps_json (array of steps)</span>
          <textarea
            v-model="draft.tutorial_steps_json"
            rows="10"
            class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
            spellcheck="false"
          />
        </label>
        <div class="text-xs text-neutral-500">
          Step types: <code>reach_room</code>, <code>kill_mob</code>, <code>collect_item</code>, <code>lua_predicate</code>.
          Each step: <code>{ step, type, prompt, target_room_id?, target_template_id?, count?, script? }</code>
        </div>
      </div>
    </div>

    <div v-if="previewData" class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-2">
      <h3 class="text-sm font-semibold">Preview</h3>
      <div class="text-xs text-neutral-400">{{ previewData.preview_note }}</div>
      <div v-if="previewData.generator_body" class="mt-2">
        <div class="text-xs text-neutral-500 mb-1">generator script ({{ previewData.generator_body.length }} chars):</div>
        <pre class="bg-neutral-950 p-2 rounded text-xs overflow-auto max-h-60"><code>{{ previewData.generator_body }}</code></pre>
      </div>
      <div v-if="previewData.template_config_json" class="mt-2">
        <div class="text-xs text-neutral-500 mb-1">template_config passed to generator:</div>
        <pre class="bg-neutral-950 p-2 rounded text-xs overflow-auto"><code>{{ JSON.stringify(previewData.template_config_json, null, 2) }}</code></pre>
      </div>
      <div v-if="previewData.tutorial_steps_json && (previewData.tutorial_steps_json as Array<unknown>).length" class="mt-2">
        <div class="text-xs text-neutral-500 mb-1">tutorial steps:</div>
        <pre class="bg-neutral-950 p-2 rounded text-xs overflow-auto"><code>{{ JSON.stringify(previewData.tutorial_steps_json, null, 2) }}</code></pre>
      </div>
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
            <code>{{ region.id }}</code>; symbols not listed fall back to the global
            <NuxtLink to="/world/terrains" class="text-sky-400 hover:underline">world_terrains</NuxtLink>.
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
        <span class="block text-neutral-400 mb-1">floor_palette_json</span>
        <textarea
          v-model="draft.floor_palette_json"
          rows="14"
          class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-xs"
          spellcheck="false"
        />
      </label>
      <div v-if="paletteRows.length" class="space-y-1">
        <div class="text-xs text-neutral-500">Preview ({{ paletteRows.length }} tile(s)):</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="t in paletteRows"
            :key="t.symbol + t.name"
            class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono flex items-center gap-2"
          >
            <span
              class="inline-block w-6 text-center text-base font-bold"
              :style="swatchStyle(t.color)"
            >{{ t.symbol }}</span>
            <span class="text-neutral-300">{{ t.name }}</span>
            <span class="text-neutral-600">{{ t.color }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
