<script setup lang="ts">
import { computed } from 'vue'
import MudTerminal from '~/components/MudTerminal.vue'
import Badge from '~/components/ui/badge/Badge.vue'
import { useMudSocket } from '~/composables/useMudSocket'

const socket = useMudSocket()

const tone = computed(() => socket.status.value)
const label = computed(() => {
  switch (socket.status.value) {
    case 'open':
      return 'Connected'
    case 'closed':
      return 'Disconnected'
    default:
      return 'Connecting…'
  }
})
</script>

<template>
  <div class="relative flex h-screen w-screen bg-[#0d1117]">
    <div class="pointer-events-none absolute right-3 top-3 z-10">
      <Badge :tone="tone" class="pointer-events-auto">
        {{ label }}
      </Badge>
    </div>
    <MudTerminal class="h-full w-full" />
  </div>
</template>
