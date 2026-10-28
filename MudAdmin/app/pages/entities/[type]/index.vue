<script setup lang="ts">
import { ENTITY_SCHEMAS, isEntityType } from '~/utils/entitySchemas'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const toast = useToast()
const entityType = computed(() => String(route.params.type))

if (!isEntityType(entityType.value)) {
  throw createError({ statusCode: 404, statusMessage: `Unknown entity type: ${entityType.value}` })
}

const schema = computed(() => ENTITY_SCHEMAS[entityType.value]!)

const PAGE_SIZE = 50
const q = ref('')
const page = ref(1)
const sort = ref<'id' | 'name' | 'updated'>('id')
const showCreate = ref(false)
const selected = ref<Set<string>>(new Set())
const confirmRef = ref<{ ask: (opts: { title: string; body?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean> } | null>(null)

interface EntityRow {
  entity_id: string
  doc: Record<string, unknown>
  parent_id: string | null
  updated_at: string
}

const { data, pending, error, refresh } = await useFetch<{
  type: string
  total: number
  rows: EntityRow[]
}>(() => `/api/entities/${entityType.value}`, {
  query: { q, sort, limit: PAGE_SIZE, offset: computed(() => (page.value - 1) * PAGE_SIZE) },
  watch: [q, sort, page, entityType],
})

watch([q, sort], () => {
  page.value = 1
})

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)))
const rangeStart = computed(() => (data.value?.rows.length ?? 0) === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1)
const rangeEnd = computed(() => (page.value - 1) * PAGE_SIZE + (data.value?.rows.length ?? 0))

watch(data, () => {
  const ids = new Set((data.value?.rows ?? []).map((r) => r.entity_id))
  selected.value = new Set([...selected.value].filter((id) => ids.has(id)))
})

function toggleRow(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

const allVisibleSelected = computed(() => {
  const rows = data.value?.rows ?? []
  return rows.length > 0 && rows.every((r) => selected.value.has(r.entity_id))
})

function toggleAll() {
  const rows = data.value?.rows ?? []
  if (allVisibleSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(rows.map((r) => r.entity_id))
  }
}

async function remove(id: string) {
  let refNote = ''
  try {
    const res = await $fetch<{ references: Array<{ entity_type: string; entity_id: string; field: string }> }>(
      `/api/entities/${entityType.value}/${encodeURIComponent(id)}/references`,
    )
    if (res.references.length) {
      const shown = res.references.slice(0, 8).map((r) => `${r.entity_type}/${r.entity_id} (${r.field})`)
      refNote = `\n\nReferenced by ${res.references.length} entity(ies):\n${shown.join('\n')}${res.references.length > shown.length ? '\n…' : ''}`
    }
  } catch {
    // references endpoint is advisory only
  }
  const ok = await confirmRef.value?.ask({
    title: `Delete ${entityType.value}/${id}?`,
    body: 'This cannot be undone.' + refNote,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await $fetch(`/api/entities/${entityType.value}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    toast.success(`Deleted ${id}`)
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Delete failed')
  }
}

async function bulkRemove() {
  const ids = [...selected.value]
  if (!ids.length) return
  const ok = await confirmRef.value?.ask({
    title: `Delete ${ids.length} ${schema.value.label.toLowerCase()}?`,
    body: ids.join(', '),
    confirmLabel: 'Delete all',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await $fetch<{ deleted: number }>(`/api/entities/${entityType.value}`, {
      method: 'DELETE',
      body: { ids },
    })
    toast.success(`Deleted ${res.deleted}`)
    selected.value = new Set()
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Bulk delete failed')
  }
}

async function duplicate(row: EntityRow) {
  const ids = new Set((data.value?.rows ?? []).map((r) => r.entity_id))
  let newId = `${row.entity_id}_copy`
  let n = 2
  while (ids.has(newId)) newId = `${row.entity_id}_copy${n++}`
  try {
    await $fetch(`/api/entities/${entityType.value}`, {
      method: 'POST',
      body: { id: newId, doc: row.doc, parent_id: row.parent_id },
    })
    toast.success(`Created ${newId}`)
    await navigateTo(`/entities/${entityType.value}/${encodeURIComponent(newId)}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.error(err.data?.statusMessage ?? 'Duplicate failed')
  }
}

function fieldPreview(doc: Record<string, unknown>): string {
  const name = doc.name
  if (typeof name === 'string' && name) return name
  return ''
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-baseline gap-3">
        <h2 class="text-xl font-semibold">{{ schema.label }}</h2>
        <span v-if="data" class="text-xs text-neutral-500">{{ data.total }} total</span>
      </div>
      <UiButton v-if="schema.listMode !== 'palette'" variant="primary" size="sm" @click="showCreate = true">+ New</UiButton>
    </div>

    <TerrainPaletteView v-if="schema.listMode === 'palette'" />

    <template v-else>
    <div class="flex items-center gap-2 flex-wrap">
      <input
        v-model="q"
        placeholder="search id or name..."
        class="flex-1 min-w-48 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
      />
      <select v-model="sort" class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm">
        <option value="id">sort: id</option>
        <option value="name">sort: name</option>
        <option value="updated">sort: updated</option>
      </select>
      <UiButton v-if="selected.size" size="sm" variant="danger" @click="bulkRemove">
        Delete {{ selected.size }} selected
      </UiButton>
    </div>

    <p v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">Failed to load entities.</p>

    <div class="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left text-neutral-500 text-xs">
          <tr>
            <th class="px-3 py-2 w-8">
              <input type="checkbox" :checked="allVisibleSelected" @change="toggleAll" />
            </th>
            <th class="px-3 py-2">{{ schema.idLabel }}</th>
            <th class="px-3 py-2">name</th>
            <th class="px-3 py-2">parent</th>
            <th class="px-3 py-2">updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pending"><td colspan="6" class="px-3 py-3 text-center text-neutral-500">Loading…</td></tr>
          <tr v-else-if="!data?.rows.length"><td colspan="6" class="px-3 py-3 text-center text-neutral-500">No entities. Create one with + New.</td></tr>
          <tr v-for="row in data?.rows ?? []" :key="row.entity_id" class="border-t border-neutral-800" :class="{ 'bg-neutral-900/60': selected.has(row.entity_id) }">
            <td class="px-3 py-2">
              <input type="checkbox" :checked="selected.has(row.entity_id)" @change="toggleRow(row.entity_id)" />
            </td>
            <td class="px-3 py-2">
              <NuxtLink
                :to="`/entities/${entityType}/${encodeURIComponent(row.entity_id)}`"
                class="font-mono text-sky-400 hover:underline"
              >{{ row.entity_id }}</NuxtLink>
            </td>
            <td class="px-3 py-2">{{ fieldPreview(row.doc) }}</td>
            <td class="px-3 py-2 font-mono text-xs text-neutral-400">{{ row.parent_id ?? '' }}</td>
            <td class="px-3 py-2 text-xs text-neutral-500">{{ new Date(row.updated_at).toLocaleString() }}</td>
            <td class="px-3 py-2 text-right whitespace-nowrap">
              <button class="text-neutral-300 hover:underline text-xs mr-3" @click="duplicate(row)">duplicate</button>
              <button class="text-red-400 hover:underline text-xs" @click="remove(row.entity_id)">delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1 || data?.total" class="flex items-center justify-between text-xs text-neutral-500">
      <span v-if="data">{{ rangeStart }}–{{ rangeEnd }} of {{ data.total }}</span>
      <span v-else></span>
      <div class="flex items-center gap-2">
        <UiButton size="sm" :disabled="page <= 1" @click="page--">← Prev</UiButton>
        <span>page {{ page }} / {{ totalPages }}</span>
        <UiButton size="sm" :disabled="page >= totalPages" @click="page++">Next →</UiButton>
      </div>
    </div>

    <EntityCreatePanel v-if="showCreate" :entity-type="entityType" @created="() => {}" @close="showCreate = false" />
    <UiConfirmDialog ref="confirmRef" />
    </template>
  </div>
</template>
