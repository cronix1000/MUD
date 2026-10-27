<script setup lang="ts">
import { ANSI_COLORS, ansiToCss } from '~/utils/ansi'

definePageMeta({ layout: 'admin' })

interface TerrainDoc {
  symbol: string
  name: string
  color: string | null
  blocks_move: boolean
  blocks_sight: boolean
  move_cost: number
}

interface TerrainRow extends TerrainDoc {
  entity_id: string
}

const { data: terrainsData, refresh } = await useFetch<{ rows: Array<{ entity_id: string; doc: Record<string, unknown> }> }>(
  '/api/entities/terrain',
  { query: { limit: 500 } },
)

const rows = computed<TerrainRow[]>(() =>
  (terrainsData.value?.rows ?? []).map((r) => {
    const d = r.doc
    return {
      entity_id: r.entity_id,
      symbol: String(d.symbol ?? r.entity_id),
      name: String(d.name ?? ''),
      color: d.color == null ? null : String(d.color),
      blocks_move: d.blocks_move === true,
      blocks_sight: d.blocks_sight === true,
      move_cost: Number(d.move_cost ?? 1),
    }
  }),
)

const newRow = ref({
  symbol: '',
  name: '',
  color: '&y',
  blocks_move: false,
  blocks_sight: false,
  move_cost: 1,
})
const editing = ref<Record<string, Partial<TerrainRow>>>({})
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const usedSymbols = computed(() => new Set(rows.value.map((r) => r.symbol)))

const symbolConflict = computed(() => usedSymbols.value.has(newRow.value.symbol))

async function addRow() {
  error.value = null
  success.value = null
  if (!newRow.value.symbol || !newRow.value.name) {
    error.value = 'symbol and name are required'
    return
  }
  try {
    await $fetch('/api/entities/terrain', {
      method: 'POST',
      body: {
        id: newRow.value.symbol,
        doc: {
          symbol: newRow.value.symbol,
          name: newRow.value.name,
          color: newRow.value.color,
          blocks_move: newRow.value.blocks_move === true,
          blocks_sight: newRow.value.blocks_sight === true,
          move_cost: Number(newRow.value.move_cost) || 1,
        },
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
  const key = r.entity_id
  const patch = editing.value[key] ?? {}
  const doc: TerrainDoc = {
    symbol: r.symbol,
    name: (patch.name ?? r.name) as string,
    color: (patch.color ?? r.color) as string | null,
    blocks_move: (patch.blocks_move ?? r.blocks_move) === true,
    blocks_sight: (patch.blocks_sight ?? r.blocks_sight) === true,
    move_cost: Number(patch.move_cost ?? r.move_cost) || 1,
  }
  try {
    await $fetch(`/api/entities/terrain/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: { doc },
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
  await $fetch(`/api/entities/terrain/${encodeURIComponent(r.entity_id)}`, { method: 'DELETE' })
  await refresh()
}

function field<K extends keyof TerrainRow>(r: TerrainRow, key: K): TerrainRow[K] {
  return (editing.value[r.entity_id]?.[key] ?? r[key]) as TerrainRow[K]
}

function setField<K extends keyof TerrainRow>(r: TerrainRow, key: K, value: TerrainRow[K]) {
  editing.value[r.entity_id] = { ...(editing.value[r.entity_id] ?? {}), [key]: value }
}

const seeding = ref(false)
const validationResults = ref<Array<{ region_id: string; room_id: number; name: string; issues: string[] }> | null>(null)

async function seedPalette() {
  seeding.value = true
  error.value = null
  success.value = null
  try {
    const res = await $fetch<{ seeded: number; skipped: boolean; message: string }>('/api/terrains/seed', {
      method: 'POST',
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

async function seedFloorsPalette() {
  seeding.value = true
  error.value = null
  success.value = null
  try {
    const res = await $fetch<{ ok: boolean; message: string }>('/api/terrains/seed-floors', {
      method: 'POST',
    })
    success.value = res.message
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Seed failed'
  } finally {
    seeding.value = false
  }
}

const { data: roomsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { region_id?: string; room_id?: number; name?: string; width?: number; height?: number; layout?: unknown } }>
}>('/api/entities/room', { query: { limit: 500 } })

function validateLayouts() {
  const palette = new Set(rows.value.map((r) => r.symbol))
  palette.add(' ')
  const results: Array<{ region_id: string; room_id: number; name: string; issues: string[] }> = []
  for (const r of roomsData.value?.rows ?? []) {
    const region = String(r.doc.region_id ?? '')
    const roomId = Number(r.doc.room_id ?? 0)
    const name = String(r.doc.name ?? '')
    const width = Number(r.doc.width ?? 0)
    const height = Number(r.doc.height ?? 0)
    const issues: string[] = []
    const parsed = r.doc.layout
    if (parsed === undefined || parsed === null) continue
    if (!Array.isArray(parsed)) {
      issues.push('layout is not an array')
      results.push({ region_id: region, room_id: roomId, name, issues })
      continue
    }
    const rowsArr = parsed as string[]
    if (rowsArr.length !== height) {
      issues.push(`row count ${rowsArr.length} ≠ height ${height}`)
    }
    for (let i = 0; i < rowsArr.length; i++) {
      if (rowsArr[i].length !== width) {
        issues.push(`row ${i} length ${rowsArr[i].length} ≠ width ${width}`)
      }
    }
    const unknown = new Set<string>()
    for (const row of rowsArr) {
      for (const c of row) {
        if (!palette.has(c)) unknown.add(c)
      }
    }
    if (unknown.size) issues.push(`unrecognized symbols: ${[...unknown].join(' ')}`)
    if (issues.length) results.push({ region_id: region, room_id: roomId, name, issues })
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
          Global fallback terrain tiles used in room layouts.
          Each region may override these in the
          <NuxtLink to="/world/regions" class="text-sky-400 hover:underline">region editor</NuxtLink>
          via <code>floor_palette</code>.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-sm disabled:opacity-50"
          :disabled="seeding"
          @click="seedPalette"
        >
          {{ seeding ? 'Seeding global…' : 'Seed global palette' }}
        </button>
        <button
          class="px-3 py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-sm disabled:opacity-50"
          :disabled="seeding"
          @click="seedFloorsPalette"
        >
          {{ seeding ? 'Seeding floors…' : 'Seed 7 floor palettes' }}
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
          <input v-model="newRow.blocks_move" type="checkbox" />
          <span>Blocks move</span>
        </label>
        <label class="col-span-1 text-sm flex items-center gap-2 mt-5">
          <input v-model="newRow.blocks_sight" type="checkbox" />
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
          <tr v-for="r in rows" :key="r.entity_id" class="hover:bg-neutral-900/60">
            <td class="px-3 py-2 border-b border-neutral-900">
              <div
                class="w-8 h-8 inline-flex items-center justify-center font-mono text-base rounded"
                :style="{ background: '#1a1a1a', color: ansiToCss(field(r,'color') as string | null) }"
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
                :checked="(field(r,'blocks_move') as boolean)"
                @change="setField(r, 'blocks_move', ($event.target as HTMLInputElement).checked)"
                type="checkbox"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <input
                :checked="(field(r,'blocks_sight') as boolean)"
                @change="setField(r, 'blocks_sight', ($event.target as HTMLInputElement).checked)"
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
              No tiles yet. Add one above or seed the starter palette.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="validationResults" class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Layout validation</h3>
      <div v-if="!validationResults.length" class="text-emerald-400 text-sm">All layouts look good.</div>
      <ul v-else class="space-y-2">
        <li v-for="r in validationResults" :key="`${r.region_id}::${r.room_id}`" class="border-l-2 border-amber-600 pl-3 text-sm">
          <NuxtLink :to="`/world_rooms/${encodeURIComponent(r.region_id + '::' + r.room_id)}`" class="text-sky-400 hover:underline font-mono">{{ r.region_id }}::{{ r.room_id }} {{ r.name }}</NuxtLink>
          <ul class="ml-4 mt-1 text-neutral-300">
            <li v-for="(iss, i) in r.issues" :key="i" class="font-mono text-xs">• {{ iss }}</li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>
