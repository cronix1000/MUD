<script setup lang="ts">
definePageMeta({ layout: 'admin' })
await navigateTo('/entities/interactable', { replace: true })
</script>

<template>
  <div class="text-neutral-400">Interactable creation moved to <NuxtLink to="/entities/interactable" class="text-sky-400 hover:underline">/entities/interactable</NuxtLink></div>
</template>
