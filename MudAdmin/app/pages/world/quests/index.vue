<script setup lang="ts">
definePageMeta({ layout: 'admin' })
await navigateTo('/entities/quest', { replace: true })
</script>

<template>
  <div class="text-neutral-400">Quests moved to <NuxtLink to="/entities/quest" class="text-sky-400 hover:underline">/entities/quest</NuxtLink></div>
</template>
