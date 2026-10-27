<script setup lang="ts">
definePageMeta({ layout: 'admin' })
await navigateTo('/entities/mob', { replace: true })
</script>

<template>
  <div class="text-neutral-400">Mobs moved to <NuxtLink to="/entities/mob" class="text-sky-400 hover:underline">/entities/mob</NuxtLink></div>
</template>
