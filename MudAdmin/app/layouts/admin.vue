<script setup lang="ts">
import { ENTITY_SCHEMAS } from '~/utils/entitySchemas'

const route = useRoute()
const { data: tablesData } = await useFetch<{ tables: string[] }>('/api/tables')
const current = computed(() => route.path.split('/').filter(Boolean))

const CONTENT_ORDER = [
  'mob', 'item', 'room', 'zone', 'region', 'interactable', 'loot_table',
  'dialogue', 'quest', 'recipe', 'skill', 'skill_category',
  'faction', 'class', 'race', 'shop', 'board', 'terrain',
]

const TYPE_DOT: Record<string, string> = {
  mob: 'bg-red-400',
  item: 'bg-yellow-400',
  room: 'bg-emerald-400',
  region: 'bg-sky-400',
  zone: 'bg-indigo-400',
  interactable: 'bg-pink-400',
  loot_table: 'bg-orange-400',
  quest: 'bg-amber-400',
  skill: 'bg-purple-400',
  recipe: 'bg-teal-400',
  dialogue: 'bg-fuchsia-400',
  skill_category: 'bg-violet-400',
  terrain: 'bg-lime-400',
  faction: 'bg-rose-400',
  class: 'bg-blue-400',
  race: 'bg-cyan-400',
  shop: 'bg-stone-400',
  board: 'bg-neutral-400',
}

const contentTypes = computed(() => {
  const known = Object.keys(ENTITY_SCHEMAS)
  const ordered = CONTENT_ORDER.filter((t) => known.includes(t))
  return ordered.concat(known.filter((t) => !ordered.includes(t))).map((t) => ({
    type: t,
    label: ENTITY_SCHEMAS[t]!.label,
    dot: TYPE_DOT[t] ?? 'bg-neutral-400',
  }))
})

const HIDDEN = new Set(['world_regions', 'world_terrains', 'world_mobs', 'world_items', 'world_interactables'])
const rawTables = computed(() => {
  const groups: Record<string, string[]> = { content: [], rooms: [], combat: [], settings: [] }
  for (const t of (tablesData.value?.tables ?? []).filter((x) => x.startsWith('world_') && !HIDDEN.has(x))) {
    if (t.includes('room') || t.includes('exit') || t.includes('spawn') || t.includes('region')) groups.rooms.push(t)
    else if (t.includes('mob') || t.includes('skill') || t.includes('dialog') || t.includes('quest') || t.includes('recipe') || t.includes('loot') || t.includes('interactable')) groups.combat.push(t)
    else if (t.includes('world') || t.includes('field_def')) groups.settings.push(t)
    else groups.content.push(t)
  }
  for (const k of Object.keys(groups)) groups[k].sort()
  return groups
})

const playerTables = computed(() => (tablesData.value?.tables ?? []).filter((x) => x.startsWith('player_')))

const isActive = {
  overview: () => current.value[0] === 'overview',
  regions: () => current.value[0] === 'world' && current.value[1] === 'regions',
  terrains: () => current.value[0] === 'entities' && current.value[1] === 'terrain',
  scripts: () => current.value[0] === 'scripts',
  migrate: () => current.value[0] === '_migrate',
  snapshots: () => current.value[0] === 'snapshots',
  entity: (t: string) => current.value[0] === 'entities' && current.value[1] === t,
  table: (t: string) => current.value.includes(t),
}
</script>

<template>
  <div class="min-h-screen flex bg-neutral-950 text-neutral-100">
    <aside class="w-64 border-r border-neutral-800 p-4 overflow-y-auto flex-shrink-0">
      <h1 class="text-lg font-semibold mb-4">MudAdmin</h1>

      <p class="text-xs uppercase tracking-wide text-neutral-500 mb-2">World</p>
      <ul class="space-y-1 mb-4">
        <li>
          <NuxtLink to="/overview" class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm" :class="{ 'bg-neutral-800': isActive.overview() }">Overview</NuxtLink>
        </li>
        <li>
          <NuxtLink to="/world/regions" class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm" :class="{ 'bg-neutral-800': isActive.regions() }">Regions</NuxtLink>
        </li>
        <li>
          <NuxtLink to="/entities/terrain" class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm" :class="{ 'bg-neutral-800': isActive.terrains() }">Terrain palette</NuxtLink>
        </li>
        <li>
          <NuxtLink to="/scripts" class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm" :class="{ 'bg-neutral-800': isActive.scripts() }">Scripts</NuxtLink>
        </li>
      </ul>

      <p class="text-xs uppercase tracking-wide text-neutral-500 mb-2">Content</p>
      <ul class="space-y-0.5 mb-4">
        <li v-for="t in contentTypes" :key="t.type">
          <NuxtLink
            :to="`/entities/${t.type}`"
            class="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': isActive.entity(t.type) }"
          >
            <span class="w-2 h-2 rounded-full flex-shrink-0" :class="t.dot"></span>
            <span class="truncate">{{ t.label }}</span>
          </NuxtLink>
        </li>
      </ul>

      <details class="mb-4" open>
        <summary class="text-xs uppercase tracking-wide text-neutral-500 cursor-pointer px-2 py-1 hover:bg-neutral-800 rounded select-none">World tree</summary>
        <div class="mt-1 ml-1">
          <AdminWorldTree />
        </div>
      </details>

      <details class="mb-4">
        <summary class="text-xs uppercase tracking-wide text-neutral-500 cursor-pointer px-2 py-1 hover:bg-neutral-800 rounded select-none">System</summary>
        <div class="mt-1 space-y-3">
          <ul class="space-y-1">
            <li>
              <NuxtLink to="/_migrate" class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm" :class="{ 'bg-neutral-800': isActive.migrate() }">Migrations</NuxtLink>
            </li>
            <li>
              <NuxtLink to="/snapshots" class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm" :class="{ 'bg-neutral-800': isActive.snapshots() }">Snapshots</NuxtLink>
            </li>
          </ul>

          <details class="ml-1">
            <summary class="text-xs text-neutral-400 cursor-pointer px-2 py-1 hover:bg-neutral-800 rounded">Player tables</summary>
            <ul class="space-y-0.5 ml-2 mt-1">
              <li v-for="t in playerTables" :key="t">
                <NuxtLink :to="`/${t}`" class="block px-2 py-1 rounded hover:bg-neutral-800 text-xs font-mono" :class="{ 'bg-neutral-800': isActive.table(t) }">{{ t }}</NuxtLink>
              </li>
            </ul>
          </details>

          <details class="ml-1">
            <summary class="text-xs text-neutral-400 cursor-pointer px-2 py-1 hover:bg-neutral-800 rounded">Legacy world tables</summary>
            <div class="ml-2 mt-1">
              <details v-for="(list, group) in rawTables" :key="group" class="mb-1">
                <summary class="text-xs text-neutral-500 cursor-pointer px-2 py-0.5 hover:bg-neutral-800 rounded capitalize">{{ group }}</summary>
                <ul class="space-y-0.5 ml-2 mt-1">
                  <li v-for="t in list" :key="t">
                    <NuxtLink :to="`/${t}`" class="block px-2 py-1 rounded hover:bg-neutral-800 text-xs font-mono" :class="{ 'bg-neutral-800': isActive.table(t) }">{{ t.replace('world_', '') }}</NuxtLink>
                  </li>
                </ul>
              </details>
            </div>
          </details>
        </div>
      </details>
    </aside>
    <main class="flex-1 p-6 overflow-auto">
      <slot />
    </main>
    <UiToast />
  </div>
</template>
