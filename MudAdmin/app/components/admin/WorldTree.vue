<script setup lang="ts">
interface TreeRoom { room_id: number; name: string }
interface TreeRegion { id: string; name: string; region_kind: string | null; rooms: TreeRoom[] }

const route = useRoute()
const { data, refresh } = await useFetch<{ regions: TreeRegion[] }>('/api/nav/tree')

const expandedRegions = ref<Set<string>>(new Set())

function toggleRegion(id: string) {
  if (expandedRegions.value.has(id)) expandedRegions.value.delete(id)
  else expandedRegions.value.add(id)
}

const roomHref = (r: string, id: number) =>
  `/admin/world_rooms/${encodeURIComponent(r + '::' + id)}`
const regionHref = (id: string) =>
  `/admin/world/regions/${encodeURIComponent(id)}`
const mapHref = (id: string) =>
  `/admin/world/regions/${encodeURIComponent(id)}/map`

function isRegionActive(id: string): boolean {
  return route.path.includes(encodeURIComponent(id))
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
    <div v-for="r in data?.regions ?? []" :key="r.id" class="my-0.5">
      <div class="flex items-center gap-1">
        <button
          class="flex items-center gap-1 px-1 py-0.5 hover:bg-neutral-800 rounded text-left flex-1 min-w-0"
          @click="toggleRegion(r.id)"
        >
          <span class="text-neutral-500 w-3">{{ expandedRegions.has(r.id) ? '▾' : '▸' }}</span>
          <span
            class="font-mono truncate"
            :class="isRegionActive(r.id) ? 'text-emerald-300' : 'text-neutral-300'"
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
          :to="mapHref(r.id)"
          class="text-xs text-sky-400 hover:underline px-1"
          title="open region map"
        >map</NuxtLink>
      </div>

      <div v-if="expandedRegions.has(r.id)" class="ml-3 border-l border-neutral-800 pl-2 mt-0.5">
        <NuxtLink
          v-for="rm in r.rooms"
          :key="rm.room_id"
          :to="roomHref(r.id, rm.room_id)"
          class="block px-1 py-0.5 text-xs hover:bg-neutral-800 rounded truncate font-mono"
          :class="route.path.includes(encodeURIComponent(r.id + '::' + rm.room_id)) ? 'text-emerald-300' : 'text-neutral-400'"
        >#{{ rm.room_id }} {{ rm.name }}</NuxtLink>
        <div v-if="!r.rooms.length" class="text-xs text-neutral-600 px-1 py-0.5 italic">no rooms</div>
      </div>
    </div>
    <div v-if="!data?.regions.length" class="text-neutral-500 italic px-1">No regions yet.</div>
  </div>
</template>