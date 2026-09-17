<script setup lang="ts">
interface TreeRoom { room_id: number; name: string }
interface TreeRegion { id: string; name: string; region_kind: string | null; rooms: TreeRoom[] }
interface TreeWorld { id: string; name: string; regions: TreeRegion[] }

const route = useRoute()
const { data, refresh } = await useFetch<{ worlds: TreeWorld[] }>('/api/nav/tree')

const expandedWorlds = ref<Set<string>>(new Set())
const expandedRegions = ref<Set<string>>(new Set())

function toggleWorld(id: string) {
  if (expandedWorlds.value.has(id)) expandedWorlds.value.delete(id)
  else expandedWorlds.value.add(id)
}

function toggleRegion(key: string) {
  if (expandedRegions.value.has(key)) expandedRegions.value.delete(key)
  else expandedRegions.value.add(key)
}

const roomHref = (w: string, r: string, id: number) =>
  `/admin/world_rooms/${encodeURIComponent(w + '::' + r + '::' + id)}`
const regionHref = (w: string, id: string) =>
  `/admin/world/regions/${encodeURIComponent(w + '::' + id)}`
const mapHref = (w: string, id: string) =>
  `/admin/world/regions/${encodeURIComponent(w + '::' + id)}/map`

function regionKey(w: string, id: string) { return `${w}::${id}` }

function isWorldActive(w: string): boolean {
  return route.path.startsWith(`/admin/world_${w}`) || route.path.startsWith(`/admin/world/${w}`)
}
function isRegionActive(w: string, id: string): boolean {
  const c = `${w}::${id}`
  return route.path.includes(encodeURIComponent(c))
}

function kindBadge(kind: string | null): string {
  switch (kind) {
    case 'instanced': return 'purple'
    case 'tutorial': return 'amber'
    default: return 'neutral'
  }
}
</script>

<template>
  <div class="text-sm">
    <div v-for="w in data?.worlds ?? []" :key="w.id" class="mb-1">
      <button
        class="w-full flex items-center gap-1 px-1 py-0.5 hover:bg-neutral-800 rounded text-left"
        @click="toggleWorld(w.id)"
      >
        <span class="text-neutral-500 w-3">{{ expandedWorlds.has(w.id) ? '▾' : '▸' }}</span>
        <span class="font-mono" :class="isWorldActive(w.id) ? 'text-emerald-300 font-semibold' : 'text-neutral-200'">
          {{ w.id }}
        </span>
        <span class="text-neutral-500 text-xs ml-1">{{ w.regions.length }}r</span>
      </button>

      <div v-if="expandedWorlds.has(w.id)" class="ml-3 border-l border-neutral-800 pl-2">
        <div v-for="r in w.regions" :key="r.id" class="my-0.5">
          <div class="flex items-center gap-1">
            <button
              class="flex items-center gap-1 px-1 py-0.5 hover:bg-neutral-800 rounded text-left flex-1 min-w-0"
              @click="toggleRegion(regionKey(w.id, r.id))"
            >
              <span class="text-neutral-500 w-3">{{ expandedRegions.has(regionKey(w.id, r.id)) ? '▾' : '▸' }}</span>
              <span
                class="font-mono truncate"
                :class="isRegionActive(w.id, r.id) ? 'text-emerald-300' : 'text-neutral-300'"
              >{{ r.id }}</span>
              <span
                v-if="r.region_kind && r.region_kind !== 'static'"
                class="text-[10px] px-1 rounded font-mono"
                :class="{
                  'bg-purple-900/40 text-purple-300': kindBadge(r.region_kind) === 'purple',
                  'bg-amber-900/40 text-amber-300': kindBadge(r.region_kind) === 'amber',
                }"
              >{{ r.region_kind }}</span>
              <span class="text-neutral-500 text-xs ml-auto">{{ r.rooms.length }}r</span>
            </button>
            <NuxtLink
              :to="mapHref(w.id, r.id)"
              class="text-xs text-sky-400 hover:underline px-1"
              title="open region map"
            >map</NuxtLink>
          </div>

          <div v-if="expandedRegions.has(regionKey(w.id, r.id))" class="ml-3 border-l border-neutral-800 pl-2 mt-0.5">
            <NuxtLink
              v-for="rm in r.rooms"
              :key="rm.room_id"
              :to="roomHref(w.id, r.id, rm.room_id)"
              class="block px-1 py-0.5 text-xs hover:bg-neutral-800 rounded truncate font-mono"
              :class="route.path.includes(encodeURIComponent(w + '::' + r + '::' + rm.room_id)) ? 'text-emerald-300' : 'text-neutral-400'"
            >#{{ rm.room_id }} {{ rm.name }}</NuxtLink>
            <div v-if="!r.rooms.length" class="text-xs text-neutral-600 px-1 py-0.5 italic">no rooms</div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!data?.worlds.length" class="text-neutral-500 italic px-1">No worlds yet.</div>
  </div>
</template>
