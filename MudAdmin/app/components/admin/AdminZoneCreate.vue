<script setup lang="ts">
const emit = defineEmits<{ created: [id: string] }>()

const { data: regionsData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { name?: string } }>
}>('/api/entities/region', { query: { limit: 500 } })

const { data: zonesData } = await useFetch<{
  rows: Array<{ entity_id: string; doc: { region_id?: string; zone_id?: number } }>
}>('/api/entities/zone', { query: { limit: 1000 } })

const regionId = ref('')
const name = ref('')

const suggestedZoneId = computed(() => {
  const used = (zonesData.value?.rows ?? [])
    .filter((z) => String(z.doc?.region_id ?? '') === regionId.value)
    .map((z) => Number(z.doc?.zone_id ?? 0))
  if (!used.length) return 1
  return Math.max(...used) + 1
})

const creating = ref(false)
const error = ref<string | null>(null)

async function create() {
  const region = regionId.value.trim()
  const nm = name.value.trim()
  if (!region || !nm) {
    error.value = 'region and name are required'
    return
  }
  const zoneNum = suggestedZoneId.value
  const id = `${region}::${zoneNum}`
  creating.value = true
  error.value = null
  try {
    await $fetch('/api/entities/zone', {
      method: 'POST',
      body: {
        id,
        doc: {
          region_id: region,
          zone_id: zoneNum,
          name: nm,
          description: '',
          is_active: true,
          rules: {},
        },
      },
    })
    emit('created', id)
    await navigateTo(`/entities/zone/${encodeURIComponent(id)}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage ?? 'Create failed'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3">
    <h3 class="text-sm font-semibold">New zone</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">region</span>
        <select v-model="regionId" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-sm">
          <option value="">— pick a region —</option>
          <option v-for="r in regionsData?.rows ?? []" :key="r.entity_id" :value="r.entity_id">{{ r.entity_id }}{{ r.doc.name ? ' — ' + r.doc.name : '' }}</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">zone_id (auto)</span>
        <input :value="regionId ? suggestedZoneId : ''" disabled class="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm opacity-60" />
      </label>
      <label class="text-sm">
        <span class="block text-neutral-400 mb-1">name</span>
        <input v-model="name" placeholder="Entry Hall" class="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm" @keydown.enter="create" />
      </label>
      <div class="flex items-end">
        <button
          class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50 w-full"
          :disabled="creating || !regionId || !name.trim()"
          @click="create"
        >
          {{ creating ? 'Creating…' : 'Create zone' }}
        </button>
      </div>
    </div>
    <p class="text-xs text-neutral-500">Starts active with empty rules — tune climate/script rules in the editor.</p>
    <p v-if="error" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>
