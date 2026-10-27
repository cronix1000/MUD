<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const tableId = decodeURIComponent(String(route.params.composite))
await navigateTo(`/entities/loot_table/${encodeURIComponent(tableId)}`, { replace: true })
</script>

<template>
  <div class="text-neutral-400">Loot table moved to <NuxtLink :to="`/entities/loot_table/${encodeURIComponent(tableId)}`" class="text-sky-400 hover:underline">/entities/loot_table/{{ tableId }}</NuxtLink></div>
</template>
