<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const recipeId = decodeURIComponent(String(route.params.composite))
await navigateTo(`/entities/recipe/${encodeURIComponent(recipeId)}`, { replace: true })
</script>

<template>
  <div class="text-neutral-400">Recipe moved to <NuxtLink :to="`/entities/recipe/${encodeURIComponent(recipeId)}`" class="text-sky-400 hover:underline">/entities/recipe/{{ recipeId }}</NuxtLink></div>
</template>
