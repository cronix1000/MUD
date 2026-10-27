<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = computed(() => Array.isArray(route.params.id) ? route.params.id.join('/') : String(route.params.id))
await navigateTo(`/entities/item/${id.value}`, { replace: true })
</script>

<template>
  <div class="text-neutral-400">Item editor moved to <NuxtLink :to="`/entities/item/${id}`" class="text-sky-400 hover:underline">/entities/item/{{ id }}</NuxtLink></div>
</template>
