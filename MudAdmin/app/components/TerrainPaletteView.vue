<script setup lang="ts">
import { tilePreviewStyle } from '~/utils/ansi'

const toast = useToast()
const confirmRef = ref<{ ask: (opts: { title: string; body?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean> } | null>(null)

interface TerrainRow {
  entity_id: string
  doc: Record<string, unknown>
  symbol: string
  name: string
  color: string
  bg_color: string
  blocks_move: boolean
  blocks_sight: boolean
  move_cost: number
}

const { data: terrainsData, refresh } = await useFetch<{
  rows: Array<{ entity_id: string; doc: Record<string, unknown> }>
}>('/api/entities/terrain', { query: { limit: 500 } })

const rows = computed<TerrainRow[]>(() =>
  (terrainsData.value?.rows ?? []).map((r) => {
    const d = r.doc
    return {
      entity_id: r.entity_id,
      doc: d,
      symbol: String(d.symbol ?? r.entity_id),
      name: String(d.name ?? ''),
      color: d.color == null ? '' : String(d.color),
      bg_color: d.bg_color == null ? '' : String(d.bg_color),
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
  bg_color: '',
  blocks_move: false,
  blocks_sight: false,
  move_cost: 1,
})

const editing = ref<Record<string, Partial<TerrainRow>>>({})

const usedSymbols = computed(() => new Set(rows.value.map((r) => r.symbol)))
const symbolConflict = computed(() => usedSymbols.value.has(newRow.value.symbol))

async function addRow() {
  if (!newRow.value.symbol || !newRow.value.name) {
    toast.error('symbol and name are required')
    return
  }
  if (symbolConflict.value) {
    toast.error(`symbol '${newRow.value.symbol}' is already in the palette`)
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
          bg_color: newRow.value.bg_color,
          blocks_move: newRow.value.blocks_move === true,
          blocks_sight: newRow.value.blocks_sight === true,
          move_cost: Number(newRow.value.move_cost) || 1,
        },
      },
    })
    toast.success(`Created ${newRow.value.symbol}`)
    newRow.value = { ...newRow.value, symbol: '', name: '' }
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Create failed')
  }
}

async function saveRow(r: TerrainRow) {
  const patch = editing.value[r.entity_id] ?? {}
  const doc: Record<string, unknown> = {
    ...r.doc,
    symbol: patch.symbol ?? r.symbol,
    name: (patch.name ?? r.name) as string,
    color: (patch.color ?? r.color) as string,
    bg_color: (patch.bg_color ?? r.bg_color) as string,
    blocks_move: (patch.blocks_move ?? r.blocks_move) === true,
    blocks_sight: (patch.blocks_sight ?? r.blocks_sight) === true,
    move_cost: Number(patch.move_cost ?? r.move_cost) || 1,
  }
  try {
    await $fetch(`/api/entities/terrain/${encodeURIComponent(r.entity_id)}`, {
      method: 'PUT',
      body: { doc },
    })
    delete editing.value[r.entity_id]
    toast.success(`Saved ${doc.symbol}`)
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Save failed')
  }
}

async function deleteRow(r: TerrainRow) {
  const ok = await confirmRef.value?.ask({
    title: `Delete tile '${r.symbol}' (${r.name})?`,
    body: 'Rooms using this symbol in layouts will show an unrecognized symbol.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await $fetch(`/api/entities/terrain/${encodeURIComponent(r.entity_id)}`, { method: 'DELETE' })
    toast.success(`Deleted ${r.symbol}`)
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Delete failed')
  }
}

function field<K extends keyof TerrainRow>(r: TerrainRow, key: K): TerrainRow[K] {
  return (editing.value[r.entity_id]?.[key] ?? r[key]) as TerrainRow[K]
}

function setField<K extends keyof TerrainRow>(r: TerrainRow, key: K, value: TerrainRow[K]) {
  editing.value[r.entity_id] = { ...(editing.value[r.entity_id] ?? {}), [key]: value }
}

const { data: roomsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { region_id?: string; room_id?: number; name?: string; width?: number; height?: number; layout?: unknown } }>
}>('/api/entities/room', { query: { limit: 500 } })

const validationResults = ref<Array<{ entity_id: string; region_id: string; room_id: number; name: string; issues: string[] }> | null>(null)

function validateLayouts() {
  const palette = new Set(rows.value.map((r) => r.symbol))
  palette.add(' ')
  const results: Array<{ entity_id: string; region_id: string; room_id: number; name: string; issues: string[] }> = []
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
      results.push({ entity_id: r.entity_id, region_id: region, room_id: roomId, name, issues })
      continue
    }
    const rowsArr = parsed as string[]
    if (rowsArr.length !== height) {
      issues.push(`row count ${rowsArr.length} != height ${height}`)
    }
    for (let i = 0; i < rowsArr.length; i++) {
      if (rowsArr[i]!.length !== width) {
        issues.push(`row ${i} length ${rowsArr[i]!.length} != width ${width}`)
      }
    }
    const unknown = new Set<string>()
    for (const row of rowsArr) {
      for (const c of row) {
        if (!palette.has(c)) unknown.add(c)
      }
    }
    if (unknown.size) issues.push(`unrecognized symbols: ${[...unknown].join(' ')}`)
    if (issues.length) results.push({ entity_id: r.entity_id, region_id: region, room_id: roomId, name, issues })
  }
  validationResults.value = results
  if (!results.length) toast.success('All layouts look good')
  else toast.info(`${results.length} room(s) with layout issues`)
}

const inputClass = 'w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm'
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-neutral-400 text-sm">
        Global fallback terrain tiles used in room layouts.
        Each region may override these in the
        <NuxtLink to="/world/regions" class="text-sky-400 hover:underline">region editor</NuxtLink>
        via <code>floor_palette</code>.
      </p>
      <UiButton size="sm" @click="validateLayouts">Validate all layouts</UiButton>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm uppercase tracking-wide text-neutral-500 mb-2">New tile</h3>
      <div class="grid grid-cols-2 md:grid-cols-8 gap-2 items-end">
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">Symbol</span>
          <input
            v-model="newRow.symbol"
            maxlength="1"
            class="w-full bg-neutral-950 border rounded px-2 py-1 font-mono text-center text-lg"
            :class="symbolConflict ? 'border-red-700' : 'border-neutral-700'"
            :title="symbolConflict ? 'Already in palette' : ''"
          />
        </label>
        <label class="text-sm md:col-span-2">
          <span class="block text-neutral-400 mb-1">Name</span>
          <input v-model="newRow.name" :class="inputClass" />
        </label>
        <label class="text-sm md:col-span-1">
          <span class="block text-neutral-400 mb-1">Foreground</span>
          <AdminAnsiColorSelect :model-value="newRow.color" @update:model-value="(v: string) => newRow.color = v" />
        </label>
        <label class="text-sm md:col-span-1">
          <span class="block text-neutral-400 mb-1">Background</span>
          <AdminAnsiColorSelect :model-value="newRow.bg_color" background @update:model-value="(v: string) => newRow.bg_color = v" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">Move cost</span>
          <input v-model.number="newRow.move_cost" type="number" min="1" :class="inputClass" />
        </label>
        <label class="text-sm flex items-center gap-2 pb-1.5">
          <input v-model="newRow.blocks_move" type="checkbox" />
          <span>Blocks move</span>
        </label>
        <div class="md:col-span-8 flex justify-end">
          <span
            class="inline-block w-8 h-8 mr-3 text-center text-lg font-bold font-mono rounded border border-neutral-700 leading-8"
            :style="tilePreviewStyle(newRow.color, newRow.bg_color)"
          >{{ newRow.symbol || '?' }}</span>
          <UiButton size="sm" variant="primary" @click="addRow">+ Add tile</UiButton>
        </div>
        <label class="text-sm flex items-center gap-2 md:col-span-8 -mt-2">
          <input v-model="newRow.blocks_sight" type="checkbox" />
          <span>Blocks sight</span>
        </label>
      </div>
    </div>

    <div class="overflow-x-auto rounded border border-neutral-800">
      <table class="w-full text-sm">
        <thead class="bg-neutral-900 text-left">
          <tr>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-16">Tile</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800">Symbol</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800">Name</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800">Foreground</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800">Background</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-24">Move cost</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-24">Blocks move</th>
            <th class="px-3 py-2 font-medium border-b border-neutral-800 w-24">Blocks sight</th>
            <th class="px-3 py-2 border-b border-neutral-800 w-36"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.entity_id" class="hover:bg-neutral-900/60">
            <td class="px-3 py-2 border-b border-neutral-900">
              <div
                class="w-8 h-8 inline-flex items-center justify-center font-mono text-base rounded border border-neutral-800"
                :style="tilePreviewStyle(field(r, 'color'), field(r, 'bg_color'))"
              >
                {{ r.symbol === ' ' ? '·' : r.symbol }}
              </div>
            </td>
            <td class="px-3 py-2 border-b border-neutral-900 font-mono">
              <NuxtLink
                v-if="!editing[r.entity_id]?.symbol"
                :to="`/entities/terrain/${encodeURIComponent(r.entity_id)}`"
                class="text-sky-400 hover:underline"
              >{{ r.symbol === ' ' ? '(space)' : r.symbol }}</NuxtLink>
              <input
                v-else
                :value="field(r, 'symbol')"
                maxlength="1"
                class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-center"
                @input="setField(r, 'symbol', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <input
                :value="field(r, 'name') as string"
                :class="inputClass"
                @input="setField(r, 'name', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900 w-44">
              <AdminAnsiColorSelect
                :model-value="field(r, 'color') as string"
                @update:model-value="(v: string) => setField(r, 'color', v)"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900 w-44">
              <AdminAnsiColorSelect
                :model-value="field(r, 'bg_color') as string"
                background
                @update:model-value="(v: string) => setField(r, 'bg_color', v)"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <input
                :value="field(r, 'move_cost') as number"
                type="number"
                min="1"
                :class="inputClass"
                @input="setField(r, 'move_cost', Number(($event.target as HTMLInputElement).value))"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <input
                :checked="field(r, 'blocks_move') as boolean"
                type="checkbox"
                @change="setField(r, 'blocks_move', ($event.target as HTMLInputElement).checked)"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900">
              <input
                :checked="field(r, 'blocks_sight') as boolean"
                type="checkbox"
                @change="setField(r, 'blocks_sight', ($event.target as HTMLInputElement).checked)"
              />
            </td>
            <td class="px-3 py-2 border-b border-neutral-900 whitespace-nowrap text-right">
              <UiButton size="sm" variant="primary" class="mr-2" @click="saveRow(r)">save</UiButton>
              <UiButton size="sm" variant="danger" @click="deleteRow(r)">delete</UiButton>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="9" class="px-3 py-6 text-center text-neutral-500">
              No tiles yet. Add one above.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="validationResults" class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Layout validation</h3>
      <div v-if="!validationResults.length" class="text-emerald-400 text-sm">All layouts look good.</div>
      <ul v-else class="space-y-2">
        <li v-for="r in validationResults" :key="r.entity_id" class="border-l-2 border-amber-600 pl-3 text-sm">
          <NuxtLink :to="`/entities/room/${encodeURIComponent(r.entity_id)}`" class="text-sky-400 hover:underline font-mono">{{ r.region_id }}::{{ r.room_id }} {{ r.name }}</NuxtLink>
          <ul class="ml-4 mt-1 text-neutral-300">
            <li v-for="(iss, i) in r.issues" :key="i" class="font-mono text-xs">• {{ iss }}</li>
          </ul>
        </li>
      </ul>
    </div>

    <UiConfirmDialog ref="confirmRef" />
  </div>
</template>
