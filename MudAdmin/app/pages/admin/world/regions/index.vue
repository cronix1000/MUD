<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Region {
  world_id: string
  id: string
  name: string
  description: string | null
  region_kind: string | null
}

const { data: regionsData } = await useFetch<{ rows: Region[] }>('/api/tables/world_regions')
const { data: worldsData } = await useFetch<{ rows: { id: string; name: string }[] }>('/api/tables/world_worlds')

const worldName = (id: string) => worldsData.value?.rows.find((w) => w.id === id)?.name ?? id

function kindColor(kind: string | null): string {
  switch (kind) {
    case 'instanced': return 'text-purple-300 bg-purple-900/30'
    case 'tutorial': return 'text-amber-300 bg-amber-900/30'
    case 'static':
    default: return 'text-neutral-400 bg-neutral-800'
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-2xl font-semibold font-mono">Regions</h2>
      <p class="text-neutral-400 text-sm mt-1">
        Pick a region to open its map or edit its kind (static / instanced / tutorial).
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      
      <div
      v-for="r in regionsData?.rows"
      :key="`${r.world_id}-${r.id}`"
      class="block p-4 rounded border border-neutral-800 hover:border-neutral-600 bg-neutral-900"
      >
      <NuxtLink
      :to="`/admin/world/regions/${encodeURIComponent(r.world_id + '::' + r.id)}`"
      class="font-mono text-sm hover:underline"
      >{{ r.id }}</NuxtLink>
      <div class="flex items-start justify-between">
        <span :class="['text-xs px-1.5 py-0.5 rounded font-mono', kindColor(r.region_kind)]">
          {{ r.region_kind ?? 'static' }}
        </span>
      </div>
      <NuxtLink
          :to="`/admin/world/regions/${encodeURIComponent(r.world_id + '::' + r.id)}/map`"
          class="text-sky-400 hover:underline"
        >
        <div class="text-neutral-400 text-xs mt-1">{{ worldName(r.world_id) }}</div>
      </NuxtLink>
        <div v-if="r.description" class="text-neutral-300 text-sm mt-2">{{ r.description }}</div>
        <div class="mt-3 flex gap-2 text-xs">
          <NuxtLink
            :to="`/admin/world/regions/${encodeURIComponent(r.world_id + '::' + r.id)}/map`"
            class="text-sky-400 hover:underline"
          >map</NuxtLink>
          <span class="text-neutral-700">·</span>
          <NuxtLink
            :to="`/admin/world/regions/${encodeURIComponent(r.world_id + '::' + r.id)}`"
            class="text-sky-400 hover:underline"
          >edit kind</NuxtLink>
        </div>
      </div>
      <div v-if="!regionsData?.rows.length" class="text-neutral-500 col-span-full">
        No regions yet. Create one via the world_regions table.
      </div>
    </div>
  </div>
</template>
