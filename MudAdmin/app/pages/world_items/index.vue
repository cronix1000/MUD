<script setup lang="ts">
definePageMeta({ layout: 'admin' })
await navigateTo('/entities/item', { replace: true })
</script>

<template>
  <div class="text-neutral-400">Items moved to <NuxtLink to="/entities/item" class="text-sky-400 hover:underline">/entities/item</NuxtLink></div>
</template>
