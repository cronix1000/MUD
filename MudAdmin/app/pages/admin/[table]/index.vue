<script setup lang="ts">
import { encodeCompositeKey, isCompositeKey } from '~/utils/composite-key'
import InspectDrawer from '~/components/admin/InspectDrawer.vue'

interface ColumnInfo { cid: number; name: string; type: string; notnull: 0 | 1; dflt_value: unknown; pk: 0 | 1 }

definePageMeta({ layout: 'admin' })

const route = useRoute()
const table = computed(() => String(route.params.table))

const PAGE_SIZE = 24

interface CardSchema {
  primary: string
  secondary: string[]
  hidden: string[]
  pk?: string
}

function detectSchema(cols: ColumnInfo[]): CardSchema {
  const names = cols.map((c) => c.name)
  const primary =
    names.find((n) => n === 'name') ??
    names.find((n) => n === 'title') ??
    names.find((n) => n === 'quest_id') ??
    names.find((n) => n === 'recipe_id') ??
    names.find((n) => n === 'template_id') ??
    names.find((n) => n === 'skill_id') ??
    names.find((n) => n === 'node_id') ??
    names.find((n) => n === 'category_id') ??
    names.find((n) => n === 'id') ??
    names[0] ?? ''
  const skip = new Set([primary, 'world_id', 'description', 'script_ref', 'extra_json', 'components_json', 'attack_patterns_json', 'dialogue_root', 'spawn_x', 'spawn_y', 'to_room_id', 'dest_x', 'dest_y', 'portal_name', 'auto_trigger', 'is_portal', 'is_one_way', 'dest_room', 'icon', 'src_room', 'color', 'char', 'block_type', 'pattern', 'layout_json'])
  const secondary = names.filter((n) => !skip.has(n) && n !== primary).slice(0, 4)
  const hidden = names.filter((n) => n !== primary && !secondary.includes(n) && /_json$/.test(n))
  const pk = cols.find((c) => c.pk === 1)?.name
  return { primary, secondary, hidden, pk: pk ?? undefined }
}

const search = ref('')
const offset = ref(0)
const view = ref<'cards' | 'table'>('cards')

const { data, refresh, pending } = await useFetch<{ columns: ColumnInfo[]; rows: Record<string, unknown>[]; limit: number; offset: number }>(
  () => {
    const q = search.value.trim()
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('offset', String(offset.value))
    params.set('limit', String(PAGE_SIZE))
    return `/api/tables/${table.value}?${params.toString()}`
  },
  { watch: [search, offset] },
)

const composite = computed(() => isCompositeKey(table.value))

const schema = computed<CardSchema>(() => {
  const cols = data.value?.columns ?? []
  return detectSchema(cols)
})

function rowKey(row: Record<string, unknown>): string {
  if (composite.value) return encodeURIComponent(encodeCompositeKey(table.value, row))
  const pk = data.value?.columns.find((c) => c.pk === 1)?.name
  return encodeURIComponent(String(pk ? row[pk] : ''))
}

function rowHref(row: Record<string, unknown>): string {
  return `/admin/${table.value}/${rowKey(row)}`
}

const totalLoaded = computed(() => data.value?.rows.length ?? 0)
const hasMore = computed(() => totalLoaded.value === PAGE_SIZE)
const hasPrev = computed(() => offset.value > 0)

const showCreate = ref(false)
const createBody = ref<Record<string, string>>({})

function openCreate() {
  createBody.value = {}
  showCreate.value = true
}

async function createRow() {
  await $fetch(`/api/tables/${table.value}`, { method: 'POST', body: createBody.value })
  showCreate.value = false
  offset.value = 0
  await refresh()
}

async function deleteRow(row: Record<string, unknown>) {
  if (!confirm('Delete this row?')) return
  await $fetch(`/api/tables/${table.value}/${rowKey(row)}`, { method: 'DELETE' })
  if (selectedRow.value === row) selectedRow.value = null
  await refresh()
}

const selectedRow = ref<Record<string, unknown> | null>(null)
const drawerOpen = computed(() => selectedRow.value !== null)

function openRow(row: Record<string, unknown>) {
  selectedRow.value = row
}
function closeDrawer() {
  selectedRow.value = null
}

const selectedKeys = ref<Set<string>>(new Set())
function toggleSelect(key: string) {
  if (selectedKeys.value.has(key)) selectedKeys.value.delete(key)
  else selectedKeys.value.add(key)
}

async function bulkDelete() {
  const keys = [...selectedKeys.value]
  if (!keys.length) return
  if (!confirm(`Delete ${keys.length} selected row(s)?`)) return
  for (const k of keys) {
    await $fetch(`/api/tables/${table.value}/${k}`, { method: 'DELETE' })
  }
  selectedKeys.value.clear()
  await refresh()
}

function formatValue(v: unknown, col?: ColumnInfo): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  if (typeof v === 'string' && v.length > 80 && (!col || !col.name.endsWith('_json'))) {
    return v.slice(0, 80) + '…'
  }
  return String(v)
}
function isJson(name: string) { return name.endsWith('_json') }
function tryParse(v: string): unknown {
  if (!v) return null
  try { return JSON.parse(v) } catch { return null }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <h2 class="text-2xl font-semibold font-mono">{{ table }}</h2>
        <span class="text-neutral-500 text-sm">{{ data?.rows.length ?? 0 }} row(s)</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <input
          v-model="search"
          placeholder="search…"
          class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm w-48"
        />
        <div class="inline-flex border border-neutral-700 rounded overflow-hidden">
          <button
            class="px-2 py-1 text-xs"
            :class="view === 'cards' ? 'bg-emerald-700 text-neutral-100' : 'bg-neutral-950 text-neutral-400'"
            @click="view = 'cards'"
          >cards</button>
          <button
            class="px-2 py-1 text-xs"
            :class="view === 'table' ? 'bg-emerald-700 text-neutral-100' : 'bg-neutral-950 text-neutral-400'"
            @click="view = 'table'"
          >table</button>
        </div>
        <button v-if="selectedKeys.size" class="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-sm" @click="bulkDelete">
          Delete {{ selectedKeys.size }} selected
        </button>
        <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="openCreate">
          + New row
        </button>
      </div>
    </div>

    <div v-if="pending && !data" class="text-neutral-500 text-sm">loading…</div>

    <div v-else-if="!data?.rows.length" class="bg-neutral-900 border border-neutral-800 rounded p-12 text-center">
      <div class="text-neutral-400 text-lg">No rows {{ search ? 'match your search' : 'yet' }}</div>
      <button class="mt-3 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="openCreate">
        + Add first row
      </button>
    </div>

    <div v-else>
      <div v-if="view === 'cards'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="row in data.rows"
          :key="JSON.stringify(row)"
          class="bg-neutral-900 border border-neutral-800 rounded p-3 hover:border-neutral-600 cursor-pointer"
          :class="selectedKeys.has(rowKey(row)) ? 'border-emerald-500 ring-1 ring-emerald-500/50' : ''"
          @click="openRow(row)"
        >
          <div class="flex items-start justify-between gap-2 mb-1">
            <div class="font-mono text-sm font-semibold text-emerald-300 truncate flex-1">
              {{ String(row[schema.primary] ?? '') }}
            </div>
            <input
              type="checkbox"
              :checked="selectedKeys.has(rowKey(row))"
              class="mt-1"
              @click.stop="toggleSelect(rowKey(row))"
            />
          </div>
          <div class="space-y-1">
            <div v-for="sec in schema.secondary" :key="sec" class="text-xs flex items-baseline gap-2">
              <span class="text-neutral-500 font-mono w-24 truncate">{{ sec }}</span>
              <span class="text-neutral-300 truncate font-mono">{{ formatValue(row[sec]) }}</span>
            </div>
          </div>
          <div class="mt-2 text-xs text-sky-400">click to inspect →</div>
        </div>
      </div>

      <div v-else class="overflow-x-auto rounded border border-neutral-800">
        <table class="w-full text-sm">
          <thead class="bg-neutral-900 text-left">
            <tr>
              <th class="px-2 py-2 border-b border-neutral-800 w-8">
                <input type="checkbox" @change="(e) => {
                  if ((e.target as HTMLInputElement).checked) data?.rows.forEach((r) => selectedKeys.add(rowKey(r)))
                  else selectedKeys.clear()
                }" />
              </th>
              <th v-for="c in data?.columns" :key="c.name" class="px-3 py-2 font-medium border-b border-neutral-800 whitespace-nowrap">
                {{ c.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in data.rows"
              :key="JSON.stringify(row)"
              class="hover:bg-neutral-900/60 cursor-pointer"
              :class="selectedKeys.has(rowKey(row)) ? 'bg-neutral-800/40' : ''"
              @click="openRow(row)"
            >
              <td class="px-2 py-1.5 border-b border-neutral-900" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedKeys.has(rowKey(row))"
                  @click="toggleSelect(rowKey(row))"
                />
              </td>
              <td v-for="c in data?.columns" :key="c.name" class="px-3 py-1.5 border-b border-neutral-900 align-top font-mono">
                <span :title="String(row[c.name])">{{ formatValue(row[c.name], c) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasPrev || hasMore" class="flex items-center justify-between mt-3 text-sm">
        <button class="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50" :disabled="!hasPrev" @click="offset = Math.max(0, offset - PAGE_SIZE)">
          ← previous
        </button>
        <span class="text-neutral-500">offset {{ offset }}</span>
        <button class="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50" :disabled="!hasMore" @click="offset += PAGE_SIZE">
          next →
        </button>
      </div>
    </div>

    <InspectDrawer
      v-if="drawerOpen"
      :row="selectedRow!"
      :columns="data?.columns ?? []"
      :table="table.value"
      :row-key="selectedRow ? rowKey(selectedRow) : ''"
      :edit-href="selectedRow ? rowHref(selectedRow) : ''"
      @close="closeDrawer"
      @delete="deleteRow"
    />

    <div v-if="showCreate" class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" @click.self="showCreate = false">
      <div class="bg-neutral-900 border border-neutral-700 rounded p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <h3 class="text-lg font-semibold mb-3">New row in {{ table }}</h3>
        <div class="space-y-3">
          <div v-for="c in data?.columns" :key="c.name" class="grid grid-cols-3 gap-2 items-start">
            <label class="text-sm font-mono pt-2">
              {{ c.name }}
              <span class="text-neutral-500">({{ c.type }})</span>
            </label>
            <textarea
              v-model="createBody[c.name]"
              :rows="c.name.endsWith('_json') ? 4 : 1"
              class="col-span-2 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm"
              :placeholder="c.dflt_value !== null ? String(c.dflt_value) : ''"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button class="px-3 py-1.5 rounded hover:bg-neutral-800 text-sm" @click="showCreate = false">Cancel</button>
          <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm" @click="createRow">Create</button>
        </div>
      </div>
    </div>
  </div>
</template>
