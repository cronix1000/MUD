<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface LootTableRow {
  table_id: string
  name: string | null
}

const { data } = await useFetch<{ rows: LootTableRow[] }>(`/api/tables/world_loot_tables`)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold font-mono">Loot tables</h2>
        <p class="text-neutral-400 text-sm mt-1">Pick a table to edit its weighted entries.</p>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <NuxtLink
        v-for="t in data?.rows"
        :key="t.table_id"
        :to="`/admin/loot/${encodeURIComponent(t.table_id)}`"
        class="block p-4 rounded border border-neutral-800 hover:border-neutral-600 bg-neutral-900"
      >
        <div class="font-mono text-sm">{{ t.table_id }}</div>
        <div class="text-neutral-400 text-sm mt-1">{{ t.name ?? '—' }}</div>
      </NuxtLink>
      <div v-if="!data?.rows.length" class="text-neutral-500 col-span-full">No loot tables yet.</div>
    </div>
  </div>
</template>