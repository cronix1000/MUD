<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface LootEntry {
  item_template_id: string
  weight: number
  min_qty: number
  max_qty: number
}

const route = useRoute()
const compositeKey = computed(() => decodeURIComponent(String(route.params.composite)))
const split = computed(() => compositeKey.value.split('::'))
const worldId = computed(() => split.value[0] ?? '')
const tableId = computed(() => split.value[1] ?? '')

const { data, refresh } = await useFetch<{ rows: Array<{ world_id: string; table_id: string; name: string | null; entries_json: string | null }> }>(
  `/api/tables/world_loot_tables`,
)
const { data: itemsData } = await useFetch<{ rows: Array<{ world_id: string; template_id: string; name: string }> }>(
  `/api/tables/world_items`,
)
const { data: mobsData } = await useFetch<{ rows: Array<{ world_id: string; template_id: string; name: string; loot_drop: string | null }> }>(
  `/api/tables/world_mobs`,
)

const table = computed(() => (data.value?.rows ?? []).find((t) => t.world_id === worldId.value && t.table_id === tableId.value))
const itemsInWorld = computed(() => (itemsData.value?.rows ?? []).filter((i) => i.world_id === worldId.value))
const linkedMobs = computed(() => (mobsData.value?.rows ?? []).filter((m) => m.world_id === worldId.value && m.loot_drop === tableId.value))

const draft = reactive({
  name: '',
  entries: [] as LootEntry[],
})

watchEffect(() => {
  if (!table.value) return
  draft.name = table.value.name ?? ''
  try {
    draft.entries = JSON.parse(table.value.entries_json ?? '[]')
  } catch {
    draft.entries = []
  }
})

function addEntry() {
  draft.entries.push({ item_template_id: '', weight: 1, min_qty: 1, max_qty: 1 })
}
function removeEntry(i: number) {
  draft.entries.splice(i, 1)
}

const totalWeight = computed(() => draft.entries.reduce((s, e) => s + (Number(e.weight) || 0), 0))

const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

async function save() {
  if (!table.value) return
  saving.value = true
  error.value = null
  try {
    const key = `${worldId.value}::${tableId.value}`
    await $fetch(`/api/tables/world_loot_tables/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: {
        name: draft.name || null,
        entries_json: JSON.stringify(draft.entries),
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
</script>

<template>
  <div v-if="!table" class="text-neutral-400">Loot table not found.</div>
  <div v-else class="space-y-4 max-w-3xl">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <NuxtLink to="/admin/world_loot_tables" class="text-sky-400 hover:underline text-sm">← loot_tables</NuxtLink>
        <h2 class="text-xl font-semibold font-mono">{{ table.table_id }}</h2>
      </div>
      <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>

    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ error }}</div>
    <div v-if="success" class="bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2 text-sm text-emerald-200">{{ success }}</div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <label class="block text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="draft.name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
      </label>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold">Entries <span class="text-neutral-500 font-normal">(total weight: {{ totalWeight }})</span></h3>
        <button class="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded" @click="addEntry">+ Add entry</button>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-neutral-500 text-xs">
          <tr>
            <th class="px-2 py-1">item</th>
            <th class="px-2 py-1 w-20">weight</th>
            <th class="px-2 py-1 w-20">min</th>
            <th class="px-2 py-1 w-20">max</th>
            <th class="px-2 py-1 w-16">chance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in draft.entries" :key="i" class="border-t border-neutral-800">
            <td class="px-2 py-1">
              <select v-model="e.item_template_id" class="w-full bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono">
                <option value="">— pick —</option>
                <option v-for="it in itemsInWorld" :key="it.template_id" :value="it.template_id">{{ it.template_id }} — {{ it.name }}</option>
              </select>
            </td>
            <td class="px-2 py-1"><input v-model.number="e.weight" type="number" min="0" class="w-full bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
            <td class="px-2 py-1"><input v-model.number="e.min_qty" type="number" min="1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
            <td class="px-2 py-1"><input v-model.number="e.max_qty" type="number" min="1" class="w-full bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 font-mono" /></td>
            <td class="px-2 py-1 text-neutral-400 font-mono text-xs">{{ totalWeight > 0 ? ((Number(e.weight) / totalWeight) * 100).toFixed(1) + '%' : '—' }}</td>
            <td class="px-2 py-1 text-right"><button class="text-red-400 hover:underline text-xs" @click="removeEntry(i)">remove</button></td>
          </tr>
          <tr v-if="!draft.entries.length"><td colspan="6" class="px-2 py-3 text-center text-neutral-500">No entries.</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="linkedMobs.length" class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Linked from mobs</h3>
      <ul class="text-sm space-y-1">
        <li v-for="m in linkedMobs" :key="m.template_id" class="font-mono">
          <NuxtLink :to="`/admin/world_mobs/${encodeURIComponent(m.world_id + '::' + m.template_id)}`" class="text-sky-400 hover:underline">{{ m.template_id }}</NuxtLink>
          <span class="text-neutral-400 ml-2">{{ m.name }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
