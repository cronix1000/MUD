<script setup lang="ts">
import { encodeCompositeKey, isCompositeKey } from '~/utils/composite-key'

interface ColumnInfo { cid: number; name: string; type: string; notnull: 0 | 1; dflt_value: unknown; pk: 0 | 1 }

definePageMeta({ layout: 'admin' })

const route = useRoute()
const table = computed(() => {
  const p = route.params.table
  return Array.isArray(p) ? p[0] : String(p)
})
const idRaw = computed(() => {
  const p = route.params.id
  return Array.isArray(p) ? p.join('/') : String(p)
})

const { data, refresh } = await useFetch<{ columns: ColumnInfo[]; rows: Record<string, unknown>[] }>(
  () => `/api/tables/${table.value}`,
)

const composite = computed(() => isCompositeKey(table.value))

function compositeFields(t: string): string[] {
  const map: Record<string, string[]> = {
    world_rooms: ['world_id', 'region_id', 'room_id'],
    world_mobs: ['world_id', 'template_id'],
    world_items: ['world_id', 'template_id'],
    world_interactables: ['world_id', 'template_id'],
    world_terrains: ['world_id', 'symbol'],
    world_loot_tables: ['world_id', 'table_id'],
    world_dialogues: ['world_id', 'node_id'],
    world_quests: ['world_id', 'quest_id'],
    world_quest_objectives: ['world_id', 'quest_id', 'ordinal'],
    world_quest_rewards: ['world_id', 'quest_id', 'ordinal'],
  }
  return map[t] ?? []
}

const row = computed<Record<string, unknown> | undefined>(() => {
  if (!data.value?.rows.length) return undefined
  if (composite.value) {
    const spec = compositeFields(table.value)
    const parts = decodeURIComponent(idRaw.value).split('::')
    return data.value.rows.find((r) =>
      spec.every((f, i) => String(r[f]) === (parts[i] ?? '')),
    )
  }
  const pkName = data.value.columns.find((c) => c.pk === 1)?.name ?? 'id'
  return data.value.rows.find((r) => String(r[pkName]) === idRaw.value)
})

const pk = computed(() => data.value?.columns.find((c) => c.pk === 1)?.name ?? null)
const draft = ref<Record<string, string>>({})

watchEffect(() => {
  if (row.value) {
    const next: Record<string, string> = {}
    for (const c of data.value?.columns ?? []) {
      const v = row.value[c.name]
      next[c.name] = v === null || v === undefined ? '' : String(v)
    }
    draft.value = next
  }
})

const saving = ref(false)
const error = ref<string | null>(null)
async function save() {
  if (!row.value) return
  saving.value = true
  error.value = null
  try {
    const urlKey = composite.value ? encodeCompositeKey(table.value, row.value) : idRaw.value
    await $fetch(`/api/tables/${table.value}/${encodeURIComponent(urlKey)}`, {
      method: 'PUT',
      body: draft.value,
    })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string }
    error.value = err?.data?.statusMessage ?? err?.statusMessage ?? 'Save failed'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AdminRoomEditor v-if="composite && table === 'world_rooms'" :composite-key="idRaw" @close="navigateTo(`/admin/${table}`)" />
    <AdminMobEditor v-else-if="composite && table === 'world_mobs'" :composite-key="idRaw" @close="navigateTo(`/admin/${table}`)" />
    <div v-else>
      <div class="flex items-center gap-3 mb-4">
        <NuxtLink :to="`/admin/${table}`" class="text-sky-400 hover:underline text-sm">← back</NuxtLink>
        <h2 class="text-xl font-semibold font-mono">{{ table }} / {{ idRaw }}</h2>
      </div>

      <div v-if="!row" class="text-neutral-400">Row not found.</div>

      <form v-else class="space-y-3 max-w-3xl" @submit.prevent="save">
        <div v-for="c in data?.columns" :key="c.name" class="grid grid-cols-3 gap-2 items-start">
          <label class="text-sm font-mono pt-2">
            {{ c.name }}
            <span class="text-neutral-500">({{ c.type }})</span>
          </label>
          <textarea
            v-model="draft[c.name]"
            :rows="c.name.endsWith('_json') ? 6 : 1"
            :disabled="c.pk === 1"
            class="col-span-2 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm disabled:opacity-50"
          />
        </div>
        <div v-if="error" class="text-red-400 text-sm">{{ error }}</div>
        <div class="flex gap-2">
          <button type="submit" :disabled="saving" class="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
