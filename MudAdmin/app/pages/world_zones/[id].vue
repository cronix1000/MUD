<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const compositeRaw = decodeURIComponent(String(route.params.id))
const keys = compositeRaw.includes('::')
  ? compositeRaw.split('::')
  : [compositeRaw]
const zoneEntityId = keys.length >= 2 ? `${keys[0]}::${keys[1]}` : compositeRaw
await navigateTo(`/entities/zone/${encodeURIComponent(zoneEntityId)}`, { replace: true })
</script>

<template>
  <div class="text-neutral-400">Zone moved to <NuxtLink :to="`/entities/zone/${encodeURIComponent(zoneEntityId)}`" class="text-sky-400 hover:underline">/entities/zone/{{ zoneEntityId }}</NuxtLink></div>
</template>
