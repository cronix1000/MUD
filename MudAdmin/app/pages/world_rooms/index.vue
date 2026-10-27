<script setup lang="ts">
definePageMeta({ layout: 'admin' })
await navigateTo('/entities/room', { replace: true })
</script>

<template>
  <div class="text-neutral-400">Rooms moved to <NuxtLink to="/entities/room" class="text-sky-400 hover:underline">/entities/room</NuxtLink></div>
</template>
