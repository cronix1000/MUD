<script setup lang="ts">
definePageMeta({ layout: 'admin' })
await navigateTo('/entities/loot_table', { replace: true })
</script>

<template>
  <div class="text-neutral-400">Loot tables moved to <NuxtLink to="/entities/loot_table" class="text-sky-400 hover:underline">/entities/loot_table</NuxtLink></div>
</template>
