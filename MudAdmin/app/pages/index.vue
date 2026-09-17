<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { data } = await useFetch<{ tables: string[] }>('/api/tables')
const playerTables = computed(() => data.value?.tables.filter((t) => t.startsWith('player_')) ?? [])
const worldTables = computed(() => data.value?.tables.filter((t) => t.startsWith('world_')) ?? [])
</script>

<template>
  <div>
    <h2 class="text-2xl font-semibold mb-2">Dashboard</h2>
    <p class="text-neutral-400 mb-6">Select a table from the sidebar to browse, edit, or delete rows.</p>

    <section class="mb-8">
      <h3 class="text-sm uppercase tracking-wide text-neutral-500 mb-3">Player tables</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <NuxtLink
          v-for="t in playerTables"
          :key="t"
          :to="`/admin/${t}`"
          class="block p-4 rounded border border-neutral-800 hover:border-neutral-600 bg-neutral-900"
        >
          <div class="font-mono text-sm">{{ t }}</div>
        </NuxtLink>
      </div>
    </section>

    <section>
      <h3 class="text-sm uppercase tracking-wide text-neutral-500 mb-3">World tables</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <NuxtLink
          v-for="t in worldTables"
          :key="t"
          :to="`/admin/${t}`"
          class="block p-4 rounded border border-neutral-800 hover:border-neutral-600 bg-neutral-900"
        >
          <div class="font-mono text-sm">{{ t }}</div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
