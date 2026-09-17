<script setup lang="ts">
const route = useRoute()
const tables = await $fetch<{ tables: string[] }>('/api/tables')
const current = computed(() => route.path.split('/').filter(Boolean))

const HIDDEN = new Set(['world_regions', 'world_terrains'])
const rawTables = computed(() => {
  const groups: Record<string, string[]> = { content: [], rooms: [], combat: [], settings: [] }
  for (const t of tables.tables.filter((x) => x.startsWith('world_') && !HIDDEN.has(x))) {
    if (t.includes('room') || t.includes('exit') || t.includes('spawn') || t.includes('region')) groups.rooms.push(t)
    else if (t.includes('mob') || t.includes('skill') || t.includes('dialog') || t.includes('quest') || t.includes('recipe') || t.includes('loot') || t.includes('interactable')) groups.combat.push(t)
    else if (t.includes('world') || t.includes('field_def')) groups.settings.push(t)
    else groups.content.push(t)
  }
  for (const k of Object.keys(groups)) groups[k].sort()
  return groups
})
</script>

<template>
  <div class="min-h-screen flex bg-neutral-950 text-neutral-100">
    <aside class="w-64 border-r border-neutral-800 p-4 overflow-y-auto flex-shrink-0">
      <h1 class="text-lg font-semibold mb-4">MudAdmin</h1>

      <p class="text-xs uppercase tracking-wide text-neutral-500 mb-2">Dashboard</p>
      <ul class="space-y-1 mb-4">
        <li>
          <NuxtLink
            to="/admin/overview"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': current.includes('overview') }"
          >Overview</NuxtLink>
        </li>
        <li>
          <NuxtLink
            to="/admin/_migrate"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': current.includes('_migrate') }"
          >Migrations</NuxtLink>
        </li>
        <li>
          <NuxtLink
            to="/admin/snapshots"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': current.includes('snapshots') }"
          >Snapshots</NuxtLink>
        </li>
      </ul>

      <p class="text-xs uppercase tracking-wide text-neutral-500 mb-2">World Building</p>
      <ul class="space-y-1 mb-4">
        <li>
          <NuxtLink
            to="/admin/world/regions"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': current.includes('regions') && !current.includes('_') }"
          >Regions</NuxtLink>
        </li>
        <li>
          <NuxtLink
            to="/admin/world/terrains"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': current.includes('terrains') }"
          >Palette</NuxtLink>
        </li>
        <li>
          <NuxtLink
            to="/admin/world/quests"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': current.includes('quests') }"
          >Quests</NuxtLink>
        </li>
        <li>
          <NuxtLink
            to="/admin/loot"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': current.includes('loot') }"
          >Loot</NuxtLink>
        </li>
        <li>
          <NuxtLink
            to="/admin/recipes"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': current.includes('recipes') }"
          >Recipes</NuxtLink>
        </li>
        <li>
          <NuxtLink
            to="/admin/scripts"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm"
            :class="{ 'bg-neutral-800': current.includes('scripts') }"
          >Scripts</NuxtLink>
        </li>
      </ul>

      <p class="text-xs uppercase tracking-wide text-neutral-500 mb-2">World Tree</p>
      <AdminWorldTree />

      <p class="text-xs uppercase tracking-wide text-neutral-500 mt-4 mb-2">Player</p>
      <ul class="space-y-1 mb-4">
        <li v-for="t in tables.tables.filter((x) => x.startsWith('player_'))" :key="t">
          <NuxtLink
            :to="`/admin/${t}`"
            class="block px-2 py-1 rounded hover:bg-neutral-800 text-sm font-mono"
            :class="{ 'bg-neutral-800': current.includes(t) }"
          >
            {{ t }}
          </NuxtLink>
        </li>
      </ul>

      <p class="text-xs uppercase tracking-wide text-neutral-500 mb-2">World raw tables</p>
      <details open class="mb-2">
        <summary class="text-xs text-neutral-400 cursor-pointer px-2 py-1 hover:bg-neutral-800 rounded">Content</summary>
        <ul class="space-y-1 ml-2 mt-1">
          <li v-for="t in rawTables.content" :key="t">
            <NuxtLink :to="`/admin/${t}`" class="block px-2 py-1 rounded hover:bg-neutral-800 text-xs font-mono" :class="{ 'bg-neutral-800': current.includes(t) }">
              {{ t.replace('world_', '') }}
            </NuxtLink>
          </li>
        </ul>
      </details>
      <details class="mb-2">
        <summary class="text-xs text-neutral-400 cursor-pointer px-2 py-1 hover:bg-neutral-800 rounded">Rooms & exits</summary>
        <ul class="space-y-1 ml-2 mt-1">
          <li v-for="t in rawTables.rooms" :key="t">
            <NuxtLink :to="`/admin/${t}`" class="block px-2 py-1 rounded hover:bg-neutral-800 text-xs font-mono" :class="{ 'bg-neutral-800': current.includes(t) }">
              {{ t.replace('world_', '') }}
            </NuxtLink>
          </li>
        </ul>
      </details>
      <details class="mb-2">
        <summary class="text-xs text-neutral-400 cursor-pointer px-2 py-1 hover:bg-neutral-800 rounded">Combat & skills</summary>
        <ul class="space-y-1 ml-2 mt-1">
          <li v-for="t in rawTables.combat" :key="t">
            <NuxtLink :to="`/admin/${t}`" class="block px-2 py-1 rounded hover:bg-neutral-800 text-xs font-mono" :class="{ 'bg-neutral-800': current.includes(t) }">
              {{ t.replace('world_', '') }}
            </NuxtLink>
          </li>
        </ul>
      </details>
      <details class="mb-2">
        <summary class="text-xs text-neutral-400 cursor-pointer px-2 py-1 hover:bg-neutral-800 rounded">Settings</summary>
        <ul class="space-y-1 ml-2 mt-1">
          <li v-for="t in rawTables.settings" :key="t">
            <NuxtLink :to="`/admin/${t}`" class="block px-2 py-1 rounded hover:bg-neutral-800 text-xs font-mono" :class="{ 'bg-neutral-800': current.includes(t) }">
              {{ t.replace('world_', '') }}
            </NuxtLink>
          </li>
        </ul>
      </details>
    </aside>
    <main class="flex-1 p-6 overflow-auto">
      <slot />
    </main>
  </div>
</template>
