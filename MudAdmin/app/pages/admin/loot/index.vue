<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const { data } = await useFetch<{ rows: Array<{ world_id: string; table_id: string; name: string | null }> }>(`/api/tables/world_loot_tables`)
const { data: worldsData } = await useFetch<{ rows: Array<{ id: string; name: string }> }>(`/api/tables/world_worlds`)
const selectedWorld = ref('')
watchEffect(() => {
  if (!selectedWorld.value && worldsData.value?.rows.length) selectedWorld.value = worldsData.value.rows[0].id
})
const filtered = computed(() => (data.value?.rows ?? []).filter((t) => t.world_id === selectedWorld.value))
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold font-mono">Loot tables</h2>
        <p class="text-neutral-400 text-sm mt-1">Pick a table to edit its weighted entries.</p>
      </div>
      <select v-model="selectedWorld" class="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono">
        <option v-for="w in worldsData?.rows" :key="w.id" :value="w.id">{{ w.id }}</option>
      </select>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <NuxtLink
        v-for="t in filtered"
        :key="`${t.world_id}-${t.table_id}`"
        :to="`/admin/loot/${encodeURIComponent(t.world_id + '::' + t.table_id)}`"
        class="block p-4 rounded border border-neutral-800 hover:border-neutral-600 bg-neutral-900"
      >
        <div class="font-mono text-sm">{{ t.table_id }}</div>
        <div class="text-neutral-400 text-sm mt-1">{{ t.name ?? '—' }}</div>
      </NuxtLink>
      <div v-if="!filtered.length" class="text-neutral-500 col-span-full">No loot tables in this world.</div>
    </div>
  </div>
</template>
