<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const questId = decodeURIComponent(String(route.params.composite))
await navigateTo(`/entities/quest/${encodeURIComponent(questId)}`, { replace: true })
</script>

<template>
  <div class="text-neutral-400">Quest moved to <NuxtLink :to="`/entities/quest/${encodeURIComponent(questId)}`" class="text-sky-400 hover:underline">/entities/quest/{{ questId }}</NuxtLink></div>
</template>
