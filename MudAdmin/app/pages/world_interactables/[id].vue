<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = computed(() => Array.isArray(route.params.id) ? route.params.id.join('/') : String(route.params.id))
await navigateTo(`/entities/interactable/${id.value}`, { replace: true })
</script>

<template>
  <div class="text-neutral-400">Interactable editor moved to <NuxtLink :to="`/entities/interactable/${id}`" class="text-sky-400 hover:underline">/entities/interactable/{{ id }}</NuxtLink></div>
</template>
