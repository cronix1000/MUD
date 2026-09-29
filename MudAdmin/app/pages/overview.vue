<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Stats {
  regions: number
  regions_static: number
  rooms: number
  exits: number
  spawns: number
  mobs: number
  npc_mobs: number
  items: number
  interactables: number
  loot_tables: number
  skills: number
  quests: number
  recipes: number
  dialogues: number
  players: number
}

interface Region {
  id: string
  name: string
  region_kind: string | null
}

const { data: stats, refresh: refreshStats } = await useFetch<Stats>('/api/overview/stats')
const { data: regionsData } = await useFetch<{ rows: Region[] }>('/api/tables/world_regions')

const regions = computed(() => regionsData.value?.rows ?? [])

const totals = computed(() => [
  { label: 'Regions', value: stats.value?.regions ?? 0, href: '/world/regions', color: 'text-emerald-300' },
  { label: 'Rooms', value: stats.value?.rooms ?? 0, href: null, color: 'text-emerald-300' },
  { label: 'Exits', value: stats.value?.exits ?? 0, href: null, color: 'text-neutral-300' },
  { label: 'Spawns', value: stats.value?.spawns ?? 0, href: null, color: 'text-neutral-300' },
  { label: 'Mobs', value: stats.value?.mobs ?? 0, href: '/world_mobs', color: 'text-red-300' },
  { label: 'NPCs', value: stats.value?.npc_mobs ?? 0, href: null, color: 'text-cyan-300' },
  { label: 'Items', value: stats.value?.items ?? 0, href: '/world_items', color: 'text-yellow-300' },
  { label: 'Interactables', value: stats.value?.interactables ?? 0, href: '/world_interactables', color: 'text-purple-300' },
  { label: 'Loot tables', value: stats.value?.loot_tables ?? 0, href: '/loot', color: 'text-neutral-300' },
  { label: 'Skills', value: stats.value?.skills ?? 0, href: null, color: 'text-emerald-300' },
  { label: 'Quests', value: stats.value?.quests ?? 0, href: '/world/quests', color: 'text-amber-300' },
  { label: 'Recipes', value: stats.value?.recipes ?? 0, href: '/recipes', color: 'text-emerald-300' },
  { label: 'Dialogues', value: stats.value?.dialogues ?? 0, href: '/world_dialogues', color: 'text-neutral-300' },
  { label: 'Players', value: stats.value?.players ?? 0, href: '/player_players', color: 'text-sky-300' },
])


function refresh() { refreshStats() }
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold">World overview</h2>
        <p class="text-neutral-400 text-sm mt-1">A live snapshot of your world.</p>
      </div>
      <button class="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sm" @click="refresh">Refresh</button>
    </div>

    <div class="grid grid-cols-3 md:grid-cols-5 gap-3">
      <div
        v-for="s in totals"
        :key="s.label"
        class="bg-neutral-900 border border-neutral-800 rounded p-3"
      >
        <NuxtLink
          v-if="s.href"
          :to="s.href"
          class="block hover:opacity-80"
        >
          <div class="text-2xl font-mono" :class="s.color">{{ s.value }}</div>
          <div class="text-xs text-neutral-400 uppercase tracking-wide mt-1">{{ s.label }}</div>
        </NuxtLink>
        <div v-else>
          <div class="text-2xl font-mono" :class="s.color">{{ s.value }}</div>
          <div class="text-xs text-neutral-400 uppercase tracking-wide mt-1">{{ s.label }}</div>
        </div>
      </div>
    </div>


    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-3">Regions ({{ regions.length }})</h3>
      <div v-if="!regions.length" class="text-neutral-500 text-sm">No regions yet. Create one via the world_regions table or visit the Regions page.</div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <NuxtLink
          v-for="r in regions"
          :key="r.id"
          :to="`/world/regions/${encodeURIComponent(r.id)}`"
          class="block px-3 py-2 rounded border border-neutral-800 hover:border-neutral-600 bg-neutral-950"
        >
          <div class="flex items-center justify-between">
            <div class="font-mono text-sm">{{ r.id }}</div>
          </div>
          <div class="text-neutral-400 text-xs mt-1">{{ r.name }}</div>
        </NuxtLink>
      </div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
      <h3 class="text-sm font-semibold mb-2">Quick links</h3>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/world/regions" class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded">All regions</NuxtLink>
        <NuxtLink to="/world/terrains" class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded">Palette</NuxtLink>
        <NuxtLink to="/world_mobs" class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded">Mobs</NuxtLink>
        <NuxtLink to="/recipes" class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded">Recipes</NuxtLink>
        <NuxtLink to="/_migrate" class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded">Migrations</NuxtLink>
        <NuxtLink to="/snapshots" class="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded">Snapshots</NuxtLink>
      </div>
    </div>
  </div>
</template>
