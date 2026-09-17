<script setup lang="ts">
import { ANSI_COLORS, ansiToCss, ansiToForeground } from '~/utils/ansi'

definePageMeta({ layout: 'admin' })

interface TerrainRow {
  world_id: string
  symbol: string
  name: string
  color: string | null
  blocks_move: number
  blocks_sight: number
  move_cost: number
}

interface World {
  id: string
  name: string
}

const { data: terrainsData, refresh } = await useFetch<{ rows: TerrainRow[] }>('/api/tables/world_terrains')
const { data: worldsData } = await useFetch<{ rows: World[] }>('/api/tables/world_worlds')

const selectedWorld = ref<string>('')
const newRow = ref({
  world_id: '',
  symbol: '',
  name: '',
  color: '&y',
  blocks_move: 0,
  blocks_sight: 0,
  move_cost: 1,
})
const editing = ref<Record<string, Partial<TerrainRow>>>({})
const error = ref<string | null>(null)
const success = ref<string | null>(null)

watchEffect(() => {
  if (!selectedWorld.value && worldsData.value?.rows.length) {
    selectedWorld.value = worldsData.value.rows[0].id
  }
  if (selectedWorld.value) {
    newRow.value.world_id = selectedWorld.value
  }
})

const rows = computed(() => (terrainsData.value?.rows ?? []).filter((r) => r.world_id === selectedWorld.value))

const usedSymbols = computed(() => new Set(rows.value.map((r) => r.symbol)))

const symbolConflict = computed(() => usedSymbols.value.has(newRow.value.symbol))

const unrecognizedSymbols = computed<Set<string>>(() => {
  const known = usedSymbols.value
  known.add(' ')
  const used = new Set<string>()
  for (const r of (terrainsData.value?.rows ?? [])) {
    if (r.world_id !== selectedWorld.value) continue
  }
  return used
})

async function addRow() {
  error.value = null
  success.value = null
  if (!newRow.value.symbol || !newRow.value.name || !newRow.value.world_id) {
    error.value = 'world_id, symbol, and name are required'
    return
  }
  try {
    await $fetch(`/api/tables/world_terrains`, {
      method: 'POST',
      body: {
        world_id: newRow.value.world_id,
        symbol: newRow.value.symbol,
        name: newRow.value.name,
        color: newRow.value.color,
        blocks_move: newRow.value.blocks_move,
        blocks_sight: newRow.value.blocks_sight,
        move_cost: newRow.value.move_cost,
      },
    })
    success.value = `Created ${newRow.value.symbol}`
    newRow.value = { ...newRow.value, symbol: '', name: '' }
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Create failed'
  }
}

async function saveRow(r: TerrainRow) {
  error.value = null
  const key = `${r.world_id}::${encodeURIComponent(r.symbol)}`
  const patch = editing.value[key] ?? {}
  try {
    await $fetch(`/api/tables/world_terrains/${key}`, {
      method: 'PUT',
      body: {
        name: patch.name ?? r.name,
        color: patch.color ?? r.color,
        blocks_move: patch.blocks_move ?? r.blocks_move,
        blocks_sight: patch.blocks_sight ?? r.blocks_sight,
        move_cost: patch.move_cost ?? r.move_cost,
      },
    })
    delete editing.value[key]
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Save failed'
  }
}

async function deleteRow(r: TerrainRow) {
  if (!confirm(`Delete tile '${r.symbol}' (${r.name})?`)) return
  const key = `${r.world_id}::${encodeURIComponent(r.symbol)}`
  await $fetch(`/api/tables/world_terrains/${key}`, { method: 'DELETE' })
  await refresh()
}

function field<K extends keyof TerrainRow>(r: TerrainRow, key: K): Partial<TerrainRow[K]> {
  const k = `${r.world_id}::${encodeURIComponent(r.symbol)}`
  return editing.value[k]?.[key] ?? r[key]
}

function setField<K extends keyof TerrainRow>(r: TerrainRow, key: K, value: TerrainRow[K]) {
  const k = `${r.world_id}::${encodeURIComponent(r.symbol)}`
  editing.value[k] = { ...(editing.value[k] ?? {}), [key]: value }
}

const seeding = ref(false)
const validationResults = ref<Array<{ room_id: number; name: string; issues: string[] }> | null>(null)

async function seedPalette() {
  if (!selectedWorld.value) return
  seeding.value = true
  error.value = null
  success.value = null
  try {
    const res = await $fetch<{ seeded: number; skipped: boolean; message: string }>('/api/terrains/seed', {
      method: 'POST',
      body: { world_id: selectedWorld.value },
    })
    success.value = res.message
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Seed failed'
  } finally {
    seeding.value = false
  }
}

const { data: roomsData } = await useFetch<{ rows: Array<{ world_id: string; region_id: string; room_id: number; name: string; width: number; height: number; layout_json: string | null }> }>('/api/tables/world_rooms')

function validateLayouts() {
  const palette = new Set(rows.value.map((r) => r.symbol))
  palette.add(' ')
  const results: Array<{ room_id: number; name: string; issues: string[] }> = []
  const rooms = (roomsData.value?.rows ?? []).filter((r) => r.world_id === selectedWorld.value)
  for (const r of rooms) {
    const issues: string[] = []
    if (!r.layout_json) continue
    let parsed: unknown = null
    try {
      parsed = JSON.parse(r.layout_json)
    } catch {
      issues.push('layout_json is not valid JSON')
      results.push({ room_id: r.room_id, name: r.name, issues })
      continue
    }
    if (!Array.isArray(parsed)) {
      issues.push('layout_json is not an array')
      results.push({ room_id: r.room_id, name: r.name, issues })
      continue
    }
    const rowsArr = parsed as string[]
    if (rowsArr.length !== r.height) {
      issues.push(`row count ${rowsArr.length} ≠ height ${r.height}`)
    }
    for (let i = 0; i < rowsArr.length; i++) {
      if (rowsArr[i].length !== r.width) {
        issues.push(`row ${i} length ${rowsArr[i].length} ≠ width ${r.width}`)
      }
    }
    const unknown = new Set<string>()
    for (const row of rowsArr) {
      for (const c of row) {
        if (!palette.has(c)) unknown.add(c)
      }
    }
    if (unknown.size) issues.push(`unrecognized symbols: ${[...unknown].join(' ')}`)
    if (issues.length) results.push({ room_id: r.room_id, name: r.name, issues })
  }
  validationResults.value = results
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold font-mono">Palette</h2>
        <p class="text-neutral-400 text-sm mt-1">
          Tiles used in room layouts. Palette is shared across all regions in a world.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-sm text-neutral-400">World:</label>
        <select v-model="selectedWorld" class="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono">
          <option v-for="w in worldsData?.rows" :key="w.id" :value="w.id">{{ w.id }}</option>
        </select>
        <button
          class="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-sm disabled:opacity-50"
          :disabled="seeding || !selectedWorld"
          @click="seedPalette"
        >
          {{ seeding ? 'Seeding…' : 'Seed starter palette' }}
        </button>
        <button
          class="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
          @click="validateLayouts"
        >
          Validate all layouts
        </button>
      </div>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm uppercase tracking-wide text-neutral-500 mb-2">New tile</h3>
      <div class="grid grid-cols-7 gap-2 items-end">
        <label class="col-span-1 text-sm">
          <span class="block text-neutral-400 mb-1">Symbol</span>
          <input
            v-model="newRow.symbol"
            maxlength="1"
            class="w-full bg-neutral-950 border rounded px-2 py-1 font-mono text-center text-lg"
            :class="symbolConflict ? 'border-red-700' : 'border-neutral-700'"
            :title="symbolConflict ? 'Already in palette' : ''"
          />
        </label>
        <label class="col-span-2 text-sm">
          <span class="block text-neutral-400 mb-1">Name</span>
          <input v-model="newRow.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="col-span-1 text-sm">
          <span class="block text-neutral-400 mb-1">Color</span>
          <select v-model="newRow.color" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono">
            <option v-for="c in ANSI_COLORS" :key="c.code" :value="c.code">{{ c.code }} {{ c.label }}</option>
          </select>
        </label>
        <label class="col-span-1 text-sm">
          <span class="block text-neutral-400 mb-1">Move cost</span>
          <input v-model.number="newRow.move_cost" type="number" min="1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="col-span-1 text-sm flex items-center gap-2 mt-5">
          <input v-model="newRow.blocks_move" type="checkbox" :true-value="1" :false-value="0" />
          <span>Blocks move</span>
        </label>
        <label class="col-span-1 text-sm flex items-center gap-2 mt-5">
          <input v-model="newRow.blocks_sight" type="checkbox" :true-value="1" :false-value="0" />
          <span>Blocks sight</span>
        </label>
        <div class="col-span-7 flex justify-end">
          <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="addRow">+ Add tile</button>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto rounded border border-neutral-800">
      <table class="w-full text-sm">
        <thead class="bg-neutral-900 text-left">
          <tr>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-16">Tile</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800">Symbol</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800">Name</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800">Color</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-24">Move cost</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-24">Blocks move</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-24">Blocks sight</th>
            <th class="px-3 py-2 border-b border-neutral-800 w-32"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="`${r.world_id}-${r.symbol}`" class="hover:bg-neutral-900/60">
            <td class="px-3 py-2 border-b border-neutral-900">
              <div
                class="w-8 h-8 inline-flex items-center justify-center font-mono text-base rounded"
                :style="{ background: ansiToCss(field(r,'color') as string | null), color: ansiToForeground(field(r,'color') as string | null) }"
              >
                {{ r.symbol === ' ' ? '·' : r.symbol }}
              </div>
            </td>
            <td class="px-3 py-2 border-b border-neutral-900 font-mono">{{ r.symbol === ' ' ? '(space)' : r.symbol }}</td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <input
                :value="(field(r,'name') as string)"
                @input="setField(r, 'name', ($event.target as HTMLInputElement).value)"
                class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <select
                :value="(field(r,'color') as string | null) ?? ''"
                @change="setField(r, 'color', ($event.target as HTMLSelectElement).value)"
                class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono"
              >
                <option value="">— none —</option>
                <option v-for="c in ANSI_COLORS" :key="c.code" :value="c.code">{{ c.code }} {{ c.label }}</option>
              </select>
            </td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <input
                :value="(field(r,'move_cost') as number)"
                @input="setField(r, 'move_cost', Number(($event.target as HTMLInputElement).value))"
                type="number" min="1"
                class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <input
                :checked="!!(field(r,'blocks_move') as number)"
                @change="setField(r, 'blocks_move', ($event.target as HTMLInputElement).checked ? 1 : 0)"
                type="checkbox"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <input
                :checked="!!(field(r,'blocks_sight') as number)"
                @change="setField(r, 'blocks_sight', ($event.target as HTMLInputElement).checked ? 1 : 0)"
                type="checkbox"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900 whitespace-nowrap text-right">
              <button class="text-emerald-400 hover:underline mr-3 text-sm" @click="saveRow(r)">save</button>
              <button class="text-red-400 hover:underline text-sm" @click="deleteRow(r)">delete</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="8" class="px-3 py-6 text-center text-neutral-500">
              No tiles in this world yet. Add one above.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="validationResults" class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Layout validation</h3>
      <div v-if="!validationResults.length" class="text-emerald-400 text-sm">All layouts in this world look good.</div>
      <ul v-else class="space-y-2">
        <li v-for="r in validationResults" :key="r.room_id" class="border-l-2 border-amber-600 pl-3 text-sm">
          <NuxtLink :to="`/admin/world_rooms/${encodeURIComponent(selectedWorld + '::floor1::' + r.room_id)}`" class="text-sky-400 hover:underline font-mono">#{{ r.room_id }} {{ r.name }}</NuxtLink>
          <ul class="ml-4 mt-1 text-neutral-300">
            <li v-for="(iss, i) in r.issues" :key="i" class="font-mono text-xs">• {{ iss }}</li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>
