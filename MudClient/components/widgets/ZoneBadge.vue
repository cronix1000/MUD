<script setup lang="ts">
import { useGMCPStore } from '~/composables/useGMCPStore'

interface RoomInfo {
  num?: number
  name?: string
  zone?: number
  zoneName?: string
  region?: string
}

const store = useGMCPStore()
const roomInfo = computed<RoomInfo | null>(() => {
  const latest = store.latest<RoomInfo>('Room.Info')
  return latest ?? null
})

const visible = computed(() => {
  const info = roomInfo.value
  if (!info) return false
  return typeof info.zone === 'number' && info.zone > 0 && Boolean(info.zoneName)
})
</script>

<template>
  <div
    v-if="visible"
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-900/40 border border-indigo-700/50 text-xs font-mono text-indigo-200"
    :title="`Zone ${roomInfo?.zone} in ${roomInfo?.region ?? ''}`"
  >
    <span class="opacity-70">§</span>
    <span>{{ roomInfo?.zoneName }}</span>
    <span class="opacity-50">#{{ roomInfo?.zone }}</span>
  </div>
</template>