<script setup lang="ts">
import { ENTITY_SCHEMAS, isEntityType } from '~/utils/entitySchemas'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const entityType = computed(() => String(route.params.type))

if (!isEntityType(entityType.value)) {
  throw createError({ statusCode: 404, statusMessage: `Unknown entity type: ${entityType.value}` })
}

const schema = computed(() => ENTITY_SCHEMAS[entityType.value]!)

const q = ref('')
const { data, pending, error, refresh } = await useFetch<{
  type: string
  rows: Array<{ entity_id: string; doc: Record<string, unknown>; parent_id: string | null; updated_at: string }>
}>(() => `/api/entities/${entityType.value}`, {
  query: { q },
})

const newName = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)

async function create() {
  const id = newName.value.trim()
  if (!id) return
  creating.value = true
  createError.value = null
  try {
    await $fetch(`/api/entities/${entityType.value}`, {
      method: 'POST',
      body: { id, doc: {} },
    })
    newName.value = ''
    await navigateTo(`/entities/${entityType.value}/${encodeURIComponent(id)}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    createError.value = err.data?.statusMessage ?? 'Create failed'
  } finally {
    creating.value = false
  }
}

async function remove(id: string) {
  if (!confirm(`Delete ${entityType.value}/${id}? This cannot be undone.`)) return
  await $fetch(`/api/entities/${entityType.value}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await refresh()
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
      <h2 class="text-xl font-semibold">{{ schema.label }}</h2>
      <span class="text-xs text-neutral-500 font-mono">entity_type: {{ entityType }}</span>
    </div>

    <div class="flex items-center gap-2">
      <input
        v-model="q"
        placeholder="search id or name..."
        class="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm"
      />
      <template v-if="!['mob', 'item', 'loot_table', 'interactable', 'zone', 'dialogue', 'room'].includes(entityType)">
        <input
          v-model="newName"
          :placeholder="`new ${schema.idLabel}...`"
          class="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm font-mono w-48"
          @keydown.enter="create"
        />
        <button
          class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50"
          :disabled="creating || !newName.trim()"
          @click="create"
        >
          {{ creating ? 'Creating…' : '+ New' }}
        </button>
      </template>
    </div>
    <AdminMobCreate v-if="entityType === 'mob'" @created="refresh" />
    <AdminItemCreate v-else-if="entityType === 'item'" @created="refresh" />
    <AdminLootTableCreate v-else-if="entityType === 'loot_table'" @created="refresh" />
    <AdminInteractableCreate v-else-if="entityType === 'interactable'" @created="refresh" />
    <AdminZoneCreate v-else-if="entityType === 'zone'" @created="refresh" />
    <AdminDialogueCreate v-else-if="entityType === 'dialogue'" @created="refresh" />
    <AdminRoomCreate v-else-if="entityType === 'room'" @created="refresh" />
    <p v-if="createError" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">{{ createError }}</p>
    <p v-if="error" class="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-200">Failed to load entities.</p>

    <div class="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left text-neutral-500 text-xs">
          <tr>
            <th class="px-3 py-2">{{ schema.idLabel }}</th>
            <th class="px-3 py-2">name</th>
            <th class="px-3 py-2">parent</th>
            <th class="px-3 py-2">updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pending"><td colspan="5" class="px-3 py-3 text-center text-neutral-500">Loading…</td></tr>
          <tr v-else-if="!data?.rows.length"><td colspan="5" class="px-3 py-3 text-center text-neutral-500">No entities. Create one above.</td></tr>
          <tr v-for="row in data?.rows ?? []" :key="row.entity_id" class="border-t border-neutral-800">
            <td class="px-3 py-2">
              <NuxtLink
                :to="`/entities/${entityType}/${encodeURIComponent(row.entity_id)}`"
                class="font-mono text-sky-400 hover:underline"
              >{{ row.entity_id }}</NuxtLink>
            </td>
            <td class="px-3 py-2">{{ fieldPreview(row.doc) }}</td>
            <td class="px-3 py-2 font-mono text-xs text-neutral-400">{{ row.parent_id ?? '' }}</td>
            <td class="px-3 py-2 text-xs text-neutral-500">{{ new Date(row.updated_at).toLocaleString() }}</td>
            <td class="px-3 py-2 text-right">
              <button class="text-red-400 hover:underline text-xs" @click="remove(row.entity_id)">delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
