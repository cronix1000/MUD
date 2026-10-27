<script setup lang="ts">
definePageMeta({ layout: 'admin' })
await navigateTo('/entities/recipe', { replace: true })
</script>

<template>
  <div class="text-neutral-400">Recipes moved to <NuxtLink to="/entities/recipe" class="text-sky-400 hover:underline">/entities/recipe</NuxtLink></div>
</template>
