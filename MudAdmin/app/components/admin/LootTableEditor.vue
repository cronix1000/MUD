<script setup lang="ts">
import { resolveWikiId } from '~/utils/wikiId'
import type { EntityArrayColumn } from './EntityArrayField.vue'

const props = defineProps<{
  entityId: string
}>()
const emit = defineEmits<{ close: [] }>()

const { data, refresh } = await useFetch<{
  record: { entity_type: string; entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }
}>(() => `/api/entities/loot_table/${encodeURIComponent(props.entityId)}`)

const currentDoc = ref<Record<string, unknown>>({})
const parentId = ref('')

watchEffect(() => {
  if (!data.value?.record) return
  currentDoc.value = data.value.record.doc
  parentId.value = data.value.record.parent_id ?? ''
})

const name = ref('')
const entries = ref<Array<{ id: string; weight: number }>>([])

watchEffect(() => {
  const d = currentDoc.value
  name.value = String(d.name ?? '')
  const raw = Array.isArray(d.entries) ? d.entries : []
  entries.value = raw.map((e) => {
    const row = (e ?? {}) as Record<string, unknown>
    return { id: String(row.id ?? ''), weight: Number(row.weight ?? 1) }
  })
})

const columns: EntityArrayColumn[] = [
  { key: 'id', label: 'item', widget: 'wiki', placeholder: 'item template_id' },
  { key: 'weight', label: 'weight', widget: 'number', min: 0, step: 1 },
]

const { data: mobsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { name?: string; loot_drop?: string } }>
}>('/api/entities/mob', { query: { limit: 500 } })

const linkedMobs = computed(() =>
  (mobsData.value?.rows ?? []).filter((m) => String(m.doc?.loot_drop ?? '') === props.entityId),
)

const totalWeight = computed(() => entries.value.reduce((acc, e) => acc + (Number(e.weight) || 0), 0))

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
    const clean = entries.value.map((e) => ({ id: resolveWikiId(e.id).trim(), weight: Number(e.weight) || 0 }))
    for (let i = 0; i < clean.length; i++) {
      if (!clean[i].id) {
        throw new Error(`entry ${i + 1}: item id is required`)
      }
    }
    const next: Record<string, unknown> = {
      ...currentDoc.value,
      name: name.value.trim(),
      entries: clean,
    }
    await $fetch(`/api/entities/loot_table/${encodeURIComponent(props.entityId)}`, {
      method: 'PUT',
      body: { doc: next, parent_id: parentId.value.trim() || null },
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
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <button class="text-sky-400 hover:underline text-sm" @click="emit('close')">← back</button>
        <h2 class="text-xl font-semibold font-mono truncate">{{ name || props.entityId }} <span class="text-neutral-500 text-sm">({{ props.entityId }})</span></h2>
      </div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sm" @click="openRaw">Raw JSON</button>
        <button class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

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
      <textarea v-model="rawText" rows="14" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"></textarea>
      <p v-if="rawError" class="text-xs text-red-300">{{ rawError }}</p>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Identity</h3>
      <div class="grid grid-cols-2 gap-3">
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">name</span>
          <input v-model="name" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1" />
        </label>
        <label class="text-sm">
          <span class="block text-neutral-400 mb-1">parent_id (prototype inheritance)</span>
          <input v-model="parentId" placeholder="loot table id to inherit from" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm" />
        </label>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold">Entries</h3>
        <span class="text-xs text-neutral-500">{{ entries.length }} items · total weight {{ totalWeight }}</span>
      </div>
      <p class="text-xs text-neutral-500 mb-3">Each entry is <span class="font-mono">{ id, weight }</span> — the C++ <span class="font-mono">LootFactory</span> rolls one item per drop, weighted.</p>
      <AdminEntityArrayField
        :model-value="entries"
        :columns="columns"
        add-label="+ Add entry"
        empty-label="Empty table — mobs linked to it drop nothing."
        @update:model-value="(v) => entries = v as Array<{ id: string; weight: number }>"
      />
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Mobs dropping this table</h3>
      <p v-if="!linkedMobs.length" class="text-xs text-neutral-500">No mob references this table via <span class="font-mono">loot_drop</span>.</p>
      <ul v-else class="space-y-1">
        <li v-for="m in linkedMobs" :key="m.entity_id">
          <NuxtLink :to="`/entities/mob/${encodeURIComponent(m.entity_id)}`" class="text-sky-400 hover:underline text-sm font-mono">{{ m.entity_id }}</NuxtLink>
          <span v-if="m.doc?.name" class="text-neutral-500 text-sm"> — {{ m.doc.name }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
